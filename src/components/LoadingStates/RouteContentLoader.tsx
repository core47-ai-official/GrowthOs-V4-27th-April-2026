import React from "react";
import { PageSkeleton } from "./PageSkeleton";

interface RouteContentLoaderProps {
  path?: string;
}

const RouteContentLoader: React.FC<RouteContentLoaderProps> = ({ path = "" }) => {
  const getSkeletonType = (): "dashboard" | "table" | "form" | "profile" | "settings" => {
    if (path.includes("profile")) return "profile";
    if (path.includes("teams")) return "table";
    if (path.includes("support")) return "settings";
    if (path.includes("connect")) return "form";
    if (path.includes("shopify") || path.includes("meta-ads")) return "dashboard";
    return "dashboard";
  };

  return (
    <div className="w-full">
      <PageSkeleton type={getSkeletonType()} />
    </div>
  );
};

export default RouteContentLoader;
