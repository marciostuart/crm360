import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { isAdmin, requireSession } from "@/lib/auth/require-session";
import { isSameOrigin } from "@/lib/http";
import { apiError } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");
const MAX_LOGO_BYTES = 1_500_000;

function validImage(buffer: Buffer, mime: string) {
  if (mime === "image/png") return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mime === "image/webp") return buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session)) return apiError("Sem permissão.", 403);
    return NextResponse.json({ ok: true, brand_color: session.brandColor, has_logo: session.hasLogo });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível carregar a identidade.", unauthorized ? 401 : 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    if (!isAdmin(session)) return apiError("Sem permissão.", 403);
    const form = await request.formData();
    const colorValue = String(form.get("brand_color") ?? session.brandColor);
    const color = colorSchema.safeParse(colorValue);
    if (!color.success) return apiError("Escolha uma cor hexadecimal válida.", 422);
    const removeLogo = String(form.get("remove_logo") ?? "false") === "true";
    const file = form.get("logo");
    let logo: Buffer | null = null;
    let mime: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_LOGO_BYTES) return apiError("A logo deve ter no máximo 1,5 MB.", 422);
      mime = file.type;
      const source = Buffer.from(await file.arrayBuffer());
      if (!validImage(source, mime)) return apiError("Formato de logo não permitido. Use PNG, JPEG ou WebP.", 422);
      try {
        logo = await sharp(source, { limitInputPixels: 16_000_000 })
          .rotate()
          .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 88, effort: 4 })
          .toBuffer();
      } catch {
        return apiError("Não foi possível processar a logo enviada.", 422);
      }
      if (logo.length > MAX_LOGO_BYTES) return apiError("A logo otimizada deve ter no máximo 1,5 MB.", 422);
      mime = "image/webp";
    }
    if (removeLogo) {
      await db().execute("UPDATE tenants SET brand_color = ?, logo_data = NULL, logo_mime = NULL, logo_updated_at = NOW(3) WHERE id = ?", [color.data, session.tenantId]);
    } else if (logo && mime) {
      await db().execute("UPDATE tenants SET brand_color = ?, logo_data = ?, logo_mime = ?, logo_updated_at = NOW(3) WHERE id = ?", [color.data, logo, mime, session.tenantId]);
    } else {
      await db().execute("UPDATE tenants SET brand_color = ? WHERE id = ?", [color.data, session.tenantId]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível salvar a identidade.", unauthorized ? 401 : 500);
  }
}
