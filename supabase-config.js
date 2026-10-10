
"use strict";

// Smart Exam BD - Supabase Configuration

const SUPABASE_URL =
  "https://eeurhitmvgmqkmjxwqha.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_0gO7v1hGfco-L2T4FoFf-w_VKqLOqcu";

let supabaseClient = null;

try {
  if (!window.supabase) {
    throw new Error(
      "Supabase লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।"
    );
  }

  if (
    !SUPABASE_URL.startsWith("https://") ||
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY.includes("এখানে_আপনার")
  ) {
    throw new Error(
      "Supabase Project URL অথবা Publishable Key সঠিকভাবে বসানো হয়নি।"
    );
  }

  // URL থেকে ভুল API path এবং শেষের slash সরানো
  const cleanUrl = SUPABASE_URL
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");

  supabaseClient = window.supabase.createClient(
    cleanUrl,
    SUPABASE_PUBLISHABLE_KEY.trim()
  );

  console.log(
    "Smart Exam BD: Supabase client তৈরি হয়েছে।"
  );

  console.log("Supabase URL:", cleanUrl);

} catch (error) {
  console.error(
    "Supabase configuration error:",
    error.message
  );
}
