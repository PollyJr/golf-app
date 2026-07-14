"use client";
import { useEffect, useState } from "react";

export function usePersistentState<T>(key:string, initial:T) {
  const [value,setValue] = useState<T>(()=>{
    if(typeof window==="undefined") return initial;
    const stored=localStorage.getItem(key);
    if(stored) try { return JSON.parse(stored) as T; } catch {}
    return initial;
  });
  useEffect(()=>{ localStorage.setItem(key,JSON.stringify(value)); },[key,value]);
  return [value,setValue] as const;
}
