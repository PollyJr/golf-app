import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const requestSchema=z.object({email:z.string().email(),redirectTo:z.string().url().optional()});
export async function POST(request:Request){const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({code:"INVALID_EMAIL"},{status:400});const supabase=await createClient();if(!supabase)return NextResponse.json({code:"DEMO_MODE"},{status:202});const {error}=await supabase.auth.signInWithOtp({email:parsed.data.email,options:{emailRedirectTo:parsed.data.redirectTo}});if(error)return NextResponse.json({code:"MAGIC_LINK_FAILED"},{status:400});return NextResponse.json({ok:true})}
