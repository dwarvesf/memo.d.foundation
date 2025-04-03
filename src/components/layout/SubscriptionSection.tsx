import React, { useState } from 'react';
import { toast } from 'sonner';

const SubscriptionSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        'https://api.fortress.d.foundation/api/v1/dynamic-events',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'subscribe_memo',
            data: {
              email: trimmedEmail,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      toast.success('Thank you for subscribing!');
      setEmail('');
    } catch (error) {
      toast.error('An error occurred. Please try again later.');
      console.error('Subscription error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-background-secondary dark:bg-secondary-background my-8 flex flex-col items-start justify-between rounded-lg p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h6 className="m-0 mb-1.5 text-sm leading-5 font-medium">
          Subscribe to Dwarves Memo
        </h6>
        <p className="text-muted-foreground mt-0 text-sm leading-5">
          Receive the latest updates directly to your inbox.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 flex font-serif xl:mt-0">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border-border dark:border-border dark:bg-background focus:border-primary min-w-[160px] flex-1 rounded-l-lg border bg-white px-4 py-3 text-[13px] leading-4 transition-colors duration-200 ease-in-out outline-none placeholder:opacity-70"
          placeholder="Email Address"
          disabled={isSubmitting}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-primary hover:bg-primary/90 dark:hover:bg-primary/80 text-primary-foreground inline-flex w-[100px] cursor-pointer items-center justify-center rounded-r-lg border-none px-4 py-3 text-sm text-[13px] leading-4 font-medium transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-70 ${isSubmitting ? 'loading' : ''}`}
        >
          <span>Subscribe</span>
          <span
            className={`border-primary-foreground ml-2 h-2 w-2 flex-shrink-0 animate-spin rounded-full border-2 border-t-transparent ${isSubmitting ? 'inline-block' : 'hidden'}`}
          ></span>
        </button>
      </form>
    </section>
  );
};

export default SubscriptionSection;
