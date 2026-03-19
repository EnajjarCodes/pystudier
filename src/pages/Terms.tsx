import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="h-12 sm:h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <span className="font-display font-bold text-sm sm:text-base">Terms of Service</span>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 font-body text-sm text-foreground">
        <div>
          <h1 className="text-2xl font-display font-black mb-1">
            <span className="text-primary">Py</span><span className="text-coral">studier</span> Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground">Last updated: March 10, 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">By accessing or using Pystudier, you agree to be bound by these Terms of Service. If you do not agree, please do not use the service.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">2. Description of Service</h2>
          <p className="text-muted-foreground">Pystudier is an AI-powered study assistant that helps students learn through chat, quizzes, notes, and document analysis. The service is provided "as is" for educational purposes.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">3. User Accounts</h2>
          <p className="text-muted-foreground">You must provide accurate information when creating an account. You are responsible for maintaining the security of your account. Inappropriate usernames or display names (including profanity, slurs, or offensive content) are not permitted and may result in account suspension.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">4. Acceptable Use</h2>
          <p className="text-muted-foreground">You agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to bypass security measures</li>
            <li>Upload harmful, offensive, or inappropriate content</li>
            <li>Share your account credentials with others</li>
            <li>Use the service to generate harmful or misleading content</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">5. AI-Generated Content</h2>
          <p className="text-muted-foreground">Pystudier uses AI to assist with learning. AI-generated responses may not always be accurate. Users should verify important information independently. Pystudier is not a substitute for professional education or advice.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">6. Privacy</h2>
          <p className="text-muted-foreground">We collect and store your chat messages, study data, and account information to provide the service. We do not sell your personal data to third parties. Your study data is private and only accessible to you.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">7. Intellectual Property</h2>
          <p className="text-muted-foreground">Pystudier and its original content, features, and functionality are owned by Pystudier. You retain ownership of any content you upload or create using the service.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">8. Termination</h2>
          <p className="text-muted-foreground">We reserve the right to suspend or terminate your account at any time for violations of these terms. You may delete your account at any time.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">9. Changes to Terms</h2>
          <p className="text-muted-foreground">We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-base">10. Contact</h2>
          <p className="text-muted-foreground">For questions about these terms, reach out through the app by asking Pylo about the creator.</p>
        </section>

        <p className="text-center text-[11px] text-muted-foreground/50 pt-4 pb-6">
          Pystudier © 2026
        </p>
      </div>
    </div>
  );
};

export default Terms;
