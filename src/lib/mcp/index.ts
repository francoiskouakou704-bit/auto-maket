import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchVehicles from "./tools/search-vehicles";
import getVehicle from "./tools/get-vehicle";
import estimateListing from "./tools/estimate-listing";
import updateListingStatus from "./tools/update-listing-status";

// Issuer MUST be the direct Supabase host — the .lovable.cloud proxy is rejected
// by RFC 8414 discovery. VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "auto-market-mcp",
  title: "Auto Market MCP",
  version: "0.2.0",
  instructions:
    "Tools to browse the Auto Market vehicle marketplace and manage your own listings. Public: `search_vehicles`, `get_vehicle`, `estimate_listing`. Authenticated: `update_listing_status` (change your own listing's status, e.g. promote a draft to published after validation).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchVehicles, getVehicle, estimateListing, updateListingStatus],
});
