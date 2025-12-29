import ConfigReviewClient from "./config-review-client";

export default function ConfigReviewPage({
  params,
}: {
  params: { configId: string };
}) {
  return <ConfigReviewClient configId={params.configId} />;
}

