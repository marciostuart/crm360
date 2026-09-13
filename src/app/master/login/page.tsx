import MasterLoginClient from "./master-login-client";

export default function MasterLoginPage() {
  return <MasterLoginClient siteKey={process.env.TURNSTILE_SITE_KEY ?? ""} />;
}
