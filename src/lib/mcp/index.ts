import { defineMcp } from "@lovable.dev/mcp-js";
import searchVehicles from "./tools/search-vehicles";
import getVehicle from "./tools/get-vehicle";
import estimateListing from "./tools/estimate-listing";

export default defineMcp({
  name: "auto-market-mcp",
  title: "Auto Market MCP",
  version: "0.1.0",
  instructions:
    "Tools to browse the Auto Market vehicle marketplace and craft AI-assisted listings. Use `search_vehicles` to find listings, `get_vehicle` for full details of one, and `estimate_listing` to generate an ad + market price estimate for a car.",
  tools: [searchVehicles, getVehicle, estimateListing],
});
