"use client";

import Button from "@/components/Button";
import FormInput from "@/components/FormInput";
import Alert from "@/components/Alert";
import { Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { sendMessage } from "@/lib/api";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({ type: "", message: "" });
    setLoading(true);
    try {
      await sendMessage({ name, email, subject, message });
      setFeedback({ type: "success", message: "Your message has been sent successfully!" });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setFeedback({ type: "error", message: "Failed to send message. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-white text-dark antialiased font-[var(--font-poppins)]">
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="mb-4 font-semibold tracking-widest text-primary">GET IN TOUCH</p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Let's Create Something Remarkable Together.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted">
            I'm currently available for new projects and collaborations. If you have an idea in mind, I would love to hear from you.
          </p>
        </div>
      </section>
      <section className="pb-28 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div className="lg:pr-10">
            <h2 className="mb-8 text-3xl font-bold">Send a Message</h2>
            {feedback.message && (
              <Alert variant={feedback.type as any} className="mb-6">
                {feedback.message}
              </Alert>
            )}
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-6">
                <FormInput
                  label="Your Name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <FormInput
                  label="Your Email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <FormInput
                label="Subject"
                placeholder="Regarding a new project"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              <div>
                <label className="text-sm font-medium text-dark mb-2 block">Your Message</label>
                <textarea
                  rows={5}
                  className="w-full rounded-xl border border-accent/15 bg-white px-4 py-3 text-base text-dark placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200"
                  placeholder="Tell me about your project, your goals, and your timeline..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                ></textarea>
              </div>
              <Button fullWidth size="lg" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>
          <div className="rounded-2xl border border-accent/15 bg-light p-10">
            <h3 className="mb-8 text-3xl font-bold">Contact Details</h3>
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Mail size={22} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Email</h4>
                  <p className="text-muted">Send your message anytime to:</p>
                  <a href="mailto:devaracreative@gmail.com" className="text-primary font-semibold hover:text-accent">
                    devaracreative@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Phone size={22} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Phone</h4>
                  <p className="text-muted">Available during business hours:</p>
                  <p className="font-semibold">+62 896 3530 1212</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <MapPin size={22} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Location</h4>
                  <p className="text-muted">Based in the beautiful island of:</p>
                  <p className="font-semibold">Denpasar, Bali, Indonesia</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
