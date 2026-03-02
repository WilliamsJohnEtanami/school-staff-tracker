import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin, Clock, Shield, Smartphone, BarChart3,
  Users, CheckCircle, ArrowRight, GraduationCap
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const features = [
  { icon: MapPin, title: "GPS Verification", desc: "Attendance is only accepted when staff are within the school's geofenced radius." },
  { icon: Clock, title: "Real-Time Tracking", desc: "Instant dashboard updates the moment staff clock in — no delays." },
  { icon: Shield, title: "Tamper-Proof", desc: "Device fingerprinting, IP logging, and location validation prevent fraud." },
  { icon: Smartphone, title: "Mobile First", desc: "Works seamlessly on any phone or tablet — no app install required." },
  { icon: BarChart3, title: "Smart Reports", desc: "Export attendance data to Excel or CSV with advanced filters and analytics." },
  { icon: Users, title: "Staff Management", desc: "Add, deactivate, or manage staff accounts from one admin panel." },
];

const steps = [
  { num: "01", title: "Admin Sets Location", desc: "Stand inside the school, click detect, and the GPS boundary is saved automatically." },
  { num: "02", title: "Staff Logs In", desc: "Each staff member signs in with their unique credentials on any device." },
  { num: "03", title: "Mark Attendance", desc: "One tap to clock in — the system verifies location, time, and device instantly." },
  { num: "04", title: "Admin Reviews", desc: "View real-time dashboards, filter by date or status, and export reports." },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center"
          >
            <GraduationCap className="w-10 h-10 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight"
          >
            Staff Attendance,{" "}
            <span className="text-primary">Verified by Location</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            A GPS-powered attendance system built for schools. No buddy punching,
            no guesswork — just verified, real-time presence tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/login")}>
              Sign In <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              See How It Works
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg max-w-xl mx-auto">
              Built specifically for school administrators who need reliable, location-verified attendance.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} custom={i}>
                <Card className="h-full border-0 shadow-md hover:shadow-lg transition-shadow bg-card">
                  <CardContent className="p-6 space-y-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <f.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-lg">
              Four simple steps from setup to daily tracking.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            className="space-y-8"
          >
            {steps.map((s, i) => (
              <motion.div
                key={s.num} variants={fadeUp} custom={i}
                className="flex gap-6 items-start"
              >
                <div className="shrink-0 w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {s.num}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center bg-primary rounded-2xl p-12 shadow-xl"
        >
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Modernize Attendance?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Sign in now to start tracking staff attendance with GPS precision.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-base px-8 gap-2"
            onClick={() => navigate("/login")}
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Staff Attendance System</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-accent" /> GPS-verified attendance tracking
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
