"use client";

import * as React from "react";

type ScaledHeroProps = {
  children: React.ReactNode;
};

export function ScaledHero({ children }: ScaledHeroProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        background: "#08090b",
      }}
    >
      {children}
    </div>
  );
}
