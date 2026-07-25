import { InboundContainersClient } from "@/components/inbound-containers/inbound-containers-client";
import { groupInboundContainers } from "@/lib/inbound-containers/group";
import { fetchInboundContainerRows } from "@/lib/queries/inbound-containers";

export default async function InboundContainersPage() {
  let initial = groupInboundContainers([]);

  try {
    const rows = await fetchInboundContainerRows();
    initial = groupInboundContainers(rows);
  } catch (error) {
    console.error("Failed to load inbound containers:", error);
  }

  return <InboundContainersClient initial={initial} />;
}
