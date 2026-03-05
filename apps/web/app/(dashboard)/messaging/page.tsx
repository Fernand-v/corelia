import { MessagingBoard } from "@/components/messaging-board";

export default function MessagingPage({
  searchParams
}: {
  searchParams?: { projectId?: string; channelId?: string };
}) {
  void searchParams;

  return (
    <main className="-mx-4 -my-6 h-[calc(100vh-4rem)] w-[calc(100%+2rem)] md:-mx-6 md:-my-8 md:w-[calc(100%+3rem)]">
      <MessagingBoard />
    </main>
  );
}
