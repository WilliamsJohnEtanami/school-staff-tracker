import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type SeoMeta = {
  title: string;
  description: string;
  robots?: string;
};

const defaultMeta: SeoMeta = {
  title: "School Flow | GPS Staff Attendance for Schools",
  description:
    "School Flow helps schools track staff attendance with GPS-verified clock-ins, break and off-site tracking, leave requests, alerts, and exportable reports.",
  robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
};

const privateMeta = (title: string, description: string): SeoMeta => ({
  title,
  description,
  robots: "noindex,nofollow,noarchive,nosnippet",
});

const routeMeta = (pathname: string): SeoMeta => {
  if (pathname === "/") return defaultMeta;
  if (pathname === "/login") {
    return privateMeta(
      "Sign In | School Flow",
      "Secure sign in for School Flow administrators and staff."
    );
  }
  if (pathname === "/forgot-password") {
    return privateMeta(
      "Forgot Password | School Flow",
      "Reset your School Flow account password securely."
    );
  }
  if (pathname === "/reset-password") {
    return privateMeta(
      "Reset Password | School Flow",
      "Create a new password for your School Flow account."
    );
  }
  if (pathname === "/admin/setup") {
    return privateMeta(
      "Admin Setup | School Flow",
      "Configure the School Flow admin account for your school."
    );
  }
  if (pathname === "/staff") {
    return privateMeta(
      "Staff Dashboard | School Flow",
      "Clock in, manage work sessions, and review attendance updates in School Flow."
    );
  }
  if (pathname === "/notifications") {
    return privateMeta(
      "Notifications | School Flow",
      "Read updates and manage attendance-related notifications in School Flow."
    );
  }
  if (pathname === "/admin" || pathname === "/admin/dashboard") {
    return privateMeta(
      "Admin Dashboard | School Flow",
      "Monitor attendance activity, clock-ins, absences, and daily admin operations in School Flow."
    );
  }
  if (pathname === "/admin/analytics") {
    return privateMeta(
      "Attendance Analytics | School Flow",
      "Review school attendance performance, trends, and staff attendance insights in School Flow."
    );
  }
  if (pathname === "/admin/staff") {
    return privateMeta(
      "Staff Management | School Flow",
      "Add, manage, and maintain staff attendance accounts in School Flow."
    );
  }
  if (pathname.startsWith("/admin/staff/")) {
    return privateMeta(
      "Staff Profile | School Flow",
      "Review detailed staff attendance information in School Flow."
    );
  }
  if (pathname === "/admin/calendar") {
    return privateMeta(
      "School Calendar | School Flow",
      "Manage school calendar events and attendance exceptions in School Flow."
    );
  }
  if (pathname === "/admin/reports") {
    return privateMeta(
      "Attendance Reports | School Flow",
      "Generate and export attendance reports for your school in School Flow."
    );
  }
  if (pathname === "/admin/settings") {
    return privateMeta(
      "Settings | School Flow",
      "Configure school location, attendance policies, and app settings in School Flow."
    );
  }
  if (pathname === "/admin/leave") {
    return privateMeta(
      "Leave Management | School Flow",
      "Review and manage staff leave requests in School Flow."
    );
  }

  return privateMeta(
    "Page Not Found | School Flow",
    "The page you requested could not be found in School Flow."
  );
};

const setMetaTag = (
  selector: string,
  attributeName: "name" | "property",
  attributeValue: string,
  content: string
) => {
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
};

const SeoController = () => {
  const location = useLocation();

  useEffect(() => {
    const meta = routeMeta(location.pathname);

    document.title = meta.title;

    setMetaTag('meta[name="description"]', "name", "description", meta.description);
    setMetaTag('meta[name="robots"]', "name", "robots", meta.robots ?? defaultMeta.robots!);
    setMetaTag('meta[name="googlebot"]', "name", "googlebot", meta.robots ?? defaultMeta.robots!);
    setMetaTag('meta[property="og:title"]', "property", "og:title", meta.title);
    setMetaTag('meta[property="og:description"]', "property", "og:description", meta.description);
    setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
    setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", meta.description);
  }, [location.pathname]);

  return null;
};

export default SeoController;
