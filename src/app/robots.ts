import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: ["/master", "/master/", "/api/master", "/api/master/"] }], host: "https://crm.360bh.com.br" };
}
