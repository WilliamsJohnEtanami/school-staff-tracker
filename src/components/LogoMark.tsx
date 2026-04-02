import { cn } from "@/lib/utils";

type LogoMarkProps = {
  alt?: string;
  className?: string;
};

const LogoMark = ({ alt = "School Flow logo", className }: LogoMarkProps) => {
  return (
    <img
      src="/school-flow-logo.png"
      alt={alt}
      className={cn("h-10 w-10 shrink-0 object-contain", className)}
    />
  );
};

export default LogoMark;
