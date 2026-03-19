import { DynamicFormAnswerModule } from "@/components/dynamic-form-answer-module";

type FormAnswerPageProps = {
  params: Promise<{
    formId: string;
  }>;
};

export default async function FormAnswerPage({ params }: FormAnswerPageProps) {
  const { formId } = await params;
  return <DynamicFormAnswerModule formId={formId} />;
}
