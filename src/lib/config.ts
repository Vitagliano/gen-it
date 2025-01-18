// Public configuration that can be used on both client and server
export const config = {
  s3: {
    bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME as string,
    region: process.env.NEXT_PUBLIC_AWS_REGION as string,
  },
} as const; 