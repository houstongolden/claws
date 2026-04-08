import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Templates | Hubify — AI OS Templates",
  },
  description:
    "Explore pre-built agent templates to launch your AI OS instantly. From personal productivity to enterprise workflows.",
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
