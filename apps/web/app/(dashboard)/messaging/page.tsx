import { MessagingBoard } from "@/components/messaging-board";

type MessagingPageProps = {
  searchParams?: Promise<{ projectId?: string | string[]; channelId?: string | string[] }>;
};

export default async function MessagingPage({ searchParams }: MessagingPageProps) {
  void (await searchParams);

  return (
    <main className="-mx-4 -my-6 h-[calc(100vh-4rem)] w-[calc(100%+2rem)] md:-mx-6 md:-my-8 md:w-[calc(100%+3rem)]">
      <MessagingBoard />
    </main>
  );
}
