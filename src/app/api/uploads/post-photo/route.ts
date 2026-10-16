import { handlePhotoUpload } from "@/lib/images/upload-request";

export async function POST(request: Request) {
  return handlePhotoUpload(request, "post_photo");
}
