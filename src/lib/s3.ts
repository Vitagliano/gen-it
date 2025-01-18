import { env } from "@/env";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Check for required environment variables

const missingVars = Object.entries(env)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required AWS environment variables: ${missingVars.join(', ')}`);
}

const s3Client = new S3Client({
  region: env.NEXT_PUBLIC_AWS_REGION,
  credentials: {
    accessKeyId: "AKIASJO5BJOUQM5PHGN6",
    secretAccessKey: "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",
  },
});

export const uploadToS3 = async (buffer: Buffer, key: string): Promise<string> => {
  try {
    const command = new PutObjectCommand({
      Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    });

    await s3Client.send(command);
    return `https://${env.NEXT_PUBLIC_AWS_BUCKET_NAME}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
};

export const getS3Url = async (key: string) => {
  try {
    const command = new GetObjectCommand({
      Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Error getting S3 URL:', error);
    throw new Error('Failed to generate S3 URL');
  }
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error('Failed to delete file from S3');
  }
}; 