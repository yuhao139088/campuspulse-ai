import DatasetDetail from "@/components/production/dataset-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DatasetDetail id={id}/>;
}
