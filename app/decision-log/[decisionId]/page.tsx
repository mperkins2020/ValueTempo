// app/decision-log/[decisionId]/page.tsx
import DecisionLogDetailClient from "./decision-log-detail-client";

export default function Page({ params }: { params: { decisionId: string } }) {
  return <DecisionLogDetailClient decisionId={params.decisionId} />;
}
