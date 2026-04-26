/**
 * landing-page — Public landing page at '/'. Composed from section components.
 * Outside the authenticated sidebar layout.
 */

import { LandingNavbar } from '../components/landing/landing-navbar';
import { HeroSection } from '../components/landing/hero-section';
import { ProblemSection } from '../components/landing/problem-section';
import { FeaturesSection } from '../components/landing/features-section';
import { HowItWorksSection } from '../components/landing/how-it-works-section';
import { SecuritySection } from '../components/landing/security-section';
import { OpenSourceSection } from '../components/landing/open-source-section';
import { FooterSection } from '../components/landing/footer-section';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <LandingNavbar />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SecuritySection />
      <OpenSourceSection />
      <FooterSection />
    </div>
  );
}
