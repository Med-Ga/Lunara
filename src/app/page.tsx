import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Practice app is running 🎉</CardTitle>
          <CardDescription>
            Next.js + Tailwind CSS + shadcn/ui are all working.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button>Get started</Button>
          <Button variant="outline">Learn more</Button>
        </CardContent>
      </Card>
    </main>
  );
}
