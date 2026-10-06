import { notFound } from "next/navigation";
import { MACHINES, machineById } from "../../../../shared/slots";
import { Floor } from "./Floor";

export function generateStaticParams() {
  return MACHINES.map((machine) => ({ id: machine.id }));
}

export async function generateMetadata({ params }: PageProps<"/m/[id]">) {
  const machine = machineById((await params).id);
  if (!machine) return { title: "Planary Slots" };
  return { title: `${machine.name} — Planary Slots`, description: machine.blurb };
}

export default async function MachinePage({ params }: PageProps<"/m/[id]">) {
  const machine = machineById((await params).id);
  if (!machine) notFound();
  return <Floor id={machine.id} />;
}
