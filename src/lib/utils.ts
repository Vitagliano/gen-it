import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "./config";
import { getS3Url } from "@/lib/s3";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function getTraitImageUrl(imagePath: string): Promise<string> {
  // If the path is already a full URL, return it as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Generate the pre-signed S3 URL
  return await getS3Url(imagePath);
}
