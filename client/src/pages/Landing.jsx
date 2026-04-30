import { Link } from 'react-router-dom';
import {
  MdPhone, MdEmail, MdLocationOn, MdCheckCircle, MdStar, MdPeople, MdFamilyRestroom, MdLocalHospital,
} from 'react-icons/md';

const coverPlans = [
  { option: 1, premium: 'KES 1,500', cover: 'KES 50,000', description: 'Extended family' },
  { option: 2, premium: 'KES 3,000', cover: 'KES 100,000', description: 'Extended family' },
  { option: 3, premium: 'KES 6,000', cover: 'KES 200,000', description: 'Extended family' },
  { option: 4, premium: 'KES 9,000', cover: 'KES 300,000', description: 'Extended family' },
  { option: 5, premium: 'KES 12,000', cover: 'KES 400,000', description: 'Extended family' },
  { option: 6, premium: 'KES 15,000', cover: 'KES 500,000', description: 'Extended family' },
];

const steps = [
  { num: '01', title: 'Register via Agent', desc: 'Visit one of our registered agents who will capture your details and submit your application.' },
  { num: '02', title: 'Admin Approval', desc: 'Our team reviews your application. Once approved, you receive your membership number and virtual card.' },
  { num: '03', title: 'Get Covered', desc: 'Your cover is active. You and your family are protected. Make claims through your member portal.' },
];

const keyTerms = [
  { label: 'Waiting Period (General)', value: '2 months' },
  { label: 'Waiting Period (Parents)', value: '3 months' },
  { label: 'Max Children Covered', value: '4 children' },
  { label: 'Max Parents Covered', value: '4 parents' },
  { label: 'Max Claims Per Year', value: '6 claims/family' },
  { label: 'Maximum Entry Age (Children)', value: '25 years' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-body">
      {/* Navbar */}
      <nav className="bg-brand-navy sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div>
            <span className="font-heading font-bold text-brand-gold text-lg">My Life Companion</span>
            <span className="text-gray-400 text-xs ml-2 hidden sm:inline">Welfare</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#plans" className="text-gray-300 hover:text-brand-gold text-sm hidden md:block transition-colors">Plans</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-brand-gold text-sm hidden md:block transition-colors">How It Works</a>
            <a href="#contact" className="text-gray-300 hover:text-brand-gold text-sm hidden md:block transition-colors">Contact</a>
            <Link to="/login" className="btn-primary text-sm py-2 px-4">Member Login</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-brand-navy text-white pt-20 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-gold/20 text-brand-gold text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <MdStar size={16} /> Underwritten by Old Mutual
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Protecting Families,<br />
            <span className="text-brand-gold">One Life at a Time</span>
          </h1>
          <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            My Life Companion Welfare offers affordable funeral and family cover plans for every Kenyan family. Register today and secure peace of mind for those you love.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#plans" className="btn-primary text-base py-3 px-8">View Cover Plans</a>
            <a href="#how-it-works" className="btn-outline text-base py-3 px-8">How It Works</a>
          </div>
          <p className="text-gray-500 text-xs mt-8">
            Paybill: <strong className="text-gray-300">625625</strong> &nbsp;|&nbsp; Account: <strong className="text-gray-300">20190955</strong>
          </p>
        </div>
      </section>

      {/* Cover Plans */}
      <section id="plans" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-brand-navy mb-3">Cover Plans</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Choose the plan that fits your needs. All plans are paid annually and include a one-time joining fee of KES 200.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coverPlans.map((plan) => (
              <div
                key={plan.option}
                className={`bg-white rounded-xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow ${plan.option === 3 ? 'border-brand-gold' : 'border-gray-100'}`}
              >
                {plan.option === 3 && (
                  <div className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-3">Most Popular</div>
                )}
                <div className="text-4xl font-heading font-bold text-brand-navy mb-1">
                  {plan.premium}
                  <span className="text-sm font-normal text-gray-500">/year</span>
                </div>
                <div className="text-brand-green font-semibold text-lg mb-2">Cover: {plan.cover}</div>
                <p className="text-gray-600 text-sm">{plan.description}</p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Option {plan.option}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-brand-navy mb-3">How It Works</h2>
            <p className="text-gray-600">Getting covered is simple — just three steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-gold text-brand-navy font-heading font-bold text-xl mb-4">
                  {step.num}
                </div>
                <h3 className="font-heading font-bold text-brand-navy text-lg mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Is Covered */}
      <section className="py-20 px-4 sm:px-6 bg-brand-navy text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold mb-3">Who Is Covered</h2>
            <p className="text-gray-400">Your cover extends to your entire family unit.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: MdPeople, label: 'Principal Member', sub: 'You' },
              { icon: MdFamilyRestroom, label: 'Spouse', sub: '1 spouse' },
              { icon: MdLocalHospital, label: 'Children', sub: 'Up to 4' },
              { icon: MdPeople, label: 'Parents', sub: 'Up to 4' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-brand-navy-light rounded-xl p-6">
                <Icon size={36} className="text-brand-gold mx-auto mb-3" />
                <div className="font-semibold">{label}</div>
                <div className="text-gray-400 text-sm">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Terms */}
      <section className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-brand-navy mb-3">Key Terms & Conditions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {keyTerms.map((term) => (
              <div key={term.label} className="flex items-center gap-4 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <MdCheckCircle size={22} className="text-brand-green flex-shrink-0" />
                <div>
                  <div className="text-sm text-gray-500">{term.label}</div>
                  <div className="font-semibold text-brand-navy">{term.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-brand-navy mb-3">Contact Us</h2>
            <p className="text-gray-600">We're here to help. Reach out through any of the channels below.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="card flex flex-col items-center gap-3">
              <MdPhone size={28} className="text-brand-gold" />
              <div>
                <div className="font-semibold text-brand-navy">Phone</div>
                <a href="tel:+254118043715" className="text-gray-600 text-sm hover:text-brand-gold">+254-118-043-715</a>
              </div>
            </div>
            <div className="card flex flex-col items-center gap-3">
              <MdEmail size={28} className="text-brand-gold" />
              <div>
                <div className="font-semibold text-brand-navy">Email</div>
                <a href="mailto:info@mylife-companion.com" className="text-gray-600 text-sm hover:text-brand-gold">info@mylife-companion.com</a>
              </div>
            </div>
            <div className="card flex flex-col items-center gap-3">
              <MdLocationOn size={28} className="text-brand-gold" />
              <div>
                <div className="font-semibold text-brand-navy">Address</div>
                <p className="text-gray-600 text-sm">Development House, Floor 13, Suite 18</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-navy text-gray-400 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div>
            <span className="font-heading font-bold text-brand-gold">My Life Companion Welfare</span>
            <span className="ml-2">— Underwritten by Old Mutual</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#plans" className="hover:text-brand-gold transition-colors">Plans</a>
            <a href="#how-it-works" className="hover:text-brand-gold transition-colors">How It Works</a>
            <a href="#contact" className="hover:text-brand-gold transition-colors">Contact</a>
            <Link to="/login" className="hover:text-brand-gold transition-colors">Login</Link>
          </div>
          <div className="text-xs">© {new Date().getFullYear()} Mistified Solutions</div>
        </div>
      </footer>
    </div>
  );
}
