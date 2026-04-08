import { permanentRedirect } from "next/navigation";

export default function TrustSecurityRedirectPage() {
  permanentRedirect("/security");
}
