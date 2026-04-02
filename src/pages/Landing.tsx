import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import LogoMark from "@/components/LogoMark";
import {
  MapPin, Clock, Shield, Smartphone, BarChart3,
  Users, CheckCircle, ArrowRight, Moon, Sun
} from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import mobileCheckin from "@/assets/mobile-checkin.png";
import geofenceIllustration from "@/assets/geofence-illustration.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: "easeOut" as const },
  }),
};

const features = [
  { icon: MapPin, title: "Location Check", desc: "Staff must be on school grounds to mark attendance. If they're not there, it won't go through." },
  { icon: Clock, title: "Live Updates", desc: "The admin dashboard updates the moment someone clocks in. No waiting, no refreshing." },
  { icon: Shield, title: "Hard to Cheat", desc: "We log device info, IP addresses, and GPS coordinates. Faking attendance becomes really difficult." },
  { icon: Smartphone, title: "Works on Phones", desc: "Open a browser, log in, tap once. That's it. No app store, no downloads, no hassle." },
  { icon: BarChart3, title: "Export Reports", desc: "Pull attendance data into Excel or CSV. Filter by date, status, or staff member." },
  { icon: Users, title: "Manage Staff", desc: "Add new teachers, deactivate old accounts, reset passwords — all from one screen." },
];

const steps = [
  { num: "1", title: "Set your school's location", desc: "Open settings, stand inside the school, and hit detect. The GPS boundary saves automatically." },
  { num: "2", title: "Add your staff", desc: "Create accounts for each teacher or staff member. They'll get login credentials via email." },
  { num: "3", title: "Staff clocks in daily", desc: "They open the site on their phone, tap 'Clock In,' and the system checks their location on the spot." },
  { num: "4", title: "You review everything", desc: "Check who showed up, who was late, who didn't come. Export the data whenever you need it." },
];

const Landing = () => {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  // Check if an admin account already exists so we can hide the setup CTA
  useEffect(() => {
    let mounted = true;
    const checkAdmin = async () => {
      try {
        const res = await supabase.functions.invoke("setup-admin", { method: "GET" });
        if (res && (res as any).data) {
          // supabase-js returns { data } shape; data will be a JSON string if using older client
          const payload = (res as any).data?.exists !== undefined ? (res as any).data : await res.json();
          if (mounted) setAdminExists(Boolean(payload.exists));
        } else if (mounted) {
          // Fallback: try parsing raw response
          try {
            const raw = await res.json();
            if (mounted) setAdminExists(Boolean(raw.exists));
          } catch {
            if (mounted) setAdminExists(null);
          }
        }
      } catch (err) {
        console.error("Error checking admin existence:", err);
        if (mounted) setAdminExists(null);
      }
    };
    checkAdmin();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" alt="" />
            <span className="font-bold text-foreground text-lg">School Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(d => !d)}
              className="text-muted-foreground hover:text-foreground"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate("/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight"
              >
                Know who's actually at school.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-base sm:text-lg text-muted-foreground max-w-md"
              >
                A simple attendance system that uses GPS to verify staff are
                physically at school before they can clock in. No more sign-in
                sheets, no more guessing.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/login")}>
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>

                <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                  How It Works
                </Button>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="rounded-xl overflow-hidden shadow-xl border border-border">
                <img
                  src={dashboardMockup}
                  alt="Admin dashboard showing staff attendance list"
                  className="w-full h-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Geofence Section */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="grid md:grid-cols-2 gap-10 items-center"
          >
            <motion.div variants={fadeUp} custom={0}>
              <img
                src={geofenceIllustration}
                alt="Aerial view of a school campus with a GPS boundary"
                className="w-full max-w-sm mx-auto rounded-xl"
                loading="lazy"
              />
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold">
                If they're not at school, they can't clock in.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You set a GPS boundary around your school campus. When staff try
                to mark attendance, the system checks whether they're actually
                inside that boundary.
              </p>
              <ul className="space-y-2">
                {["You pick the center point and radius", "Location is checked every time", "Works even with spotty internet"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted-foreground text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-10">
            <motion.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl font-bold mb-2">What you get</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-lg mx-auto">
              Built for school admins who are tired of paper registers and unreliable attendance records.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} custom={i}>
                <Card className="h-full border shadow-sm hover:shadow-md transition-shadow bg-card">
                  <CardContent className="p-5 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <f.icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Mobile Section */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="grid md:grid-cols-2 gap-10 items-center"
          >
            <motion.div variants={fadeUp} custom={0} className="space-y-4 order-1">
              <h2 className="text-2xl sm:text-3xl font-bold">
                No app to install. Just open and tap.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your staff don't need to download anything. They open their phone
                browser, go to the site, log in, and tap one button. Takes about
                10 seconds once they know the process.
              </p>
              <ul className="space-y-2">
                {["Any phone with a browser and GPS works", "Staff get their own login credentials", "One tap — that's the whole process"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted-foreground text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="order-2">
              <img
                src={mobileCheckin}
                alt="Phone screen showing attendance check-in"
                className="w-full max-w-[220px] mx-auto"
                loading="lazy"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-10">
            <motion.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl font-bold mb-2">How it works</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">Four steps. That's it.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="space-y-5">
            {steps.map((s, i) => (
              <motion.div key={s.num} variants={fadeUp} custom={i} className="flex gap-4 items-start">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {s.num}
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-0.5">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center bg-primary rounded-2xl p-10 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-primary-foreground mb-3">
            Ready to ditch the paper register?
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Sign in and start tracking attendance today. Setup takes about 5 minutes.
          </p>
          <Button size="lg" variant="secondary" className="text-base px-8 gap-2" onClick={() => navigate("/login")}>
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoMark className="w-4 h-4" alt="" />
            <span className="font-medium text-foreground">School Flow</span>
          </div>
          <span>GPS-verified attendance for schools</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
