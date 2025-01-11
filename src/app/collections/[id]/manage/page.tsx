import { redirect } from "next/navigation"

export default function ManagePage({ params }: { params: { id: string } }) {
  redirect(`/collections/${params.id}/manage/attributes`)
} 