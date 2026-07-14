import { ExceptionsClient } from "@/components/exceptions/exceptions-client";
import { getDataExceptions } from "@/lib/queries/exceptions";

export default async function ExceptionsPage() {
  const { groups } = await getDataExceptions();

  return <ExceptionsClient groups={groups} />;
}
