import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SecurityError } from "@/lib/security";

export function apiError(error: unknown) {
  if (error instanceof SecurityError) return NextResponse.json({ code: error.code }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ code: "INVALID_REQUEST", issues: error.flatten().fieldErrors }, { status: 400 });
  console.error(error);
  return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
}
