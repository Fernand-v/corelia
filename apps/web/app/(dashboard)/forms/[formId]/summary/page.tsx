import { DynamicFormSummaryModule } from "@/components/dynamic-form-summary-module";

type FormSummaryPageProps = {
  params: Promise<{
    formId: string;
  }>;
};

export default async function FormSummaryPage({ params }: FormSummaryPageProps) {
  const { formId } = await params;
  return <DynamicFormSummaryModule formId={formId} />;
}
