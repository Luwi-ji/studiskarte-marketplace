import { NewPostScreen } from "../new-post-screen";

export const metadata = { title: "New Showcase post · Studiskarte Marketplace" };

export default function NewShowcasePage({ searchParams }: PageProps<"/posts/new/showcase">) {
  return <NewPostScreen kind="showcase" searchParams={searchParams} />;
}
