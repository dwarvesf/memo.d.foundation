import React from 'react';

const SubscriptionSection: React.FC = () => {
  return (
    <section className="border-border mt-16 border-t py-12">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <div className="mb-8">
          <h2 className="mb-3 text-3xl font-bold">
            Get notified when we publish
          </h2>
          <p className="text-muted-foreground">
            Subscribe to get the latest posts by email.
          </p>
        </div>

        <div>
          <form
            action="https://foundation.us19.list-manage.com/subscribe/post?u=54e732ed7896e81d21abf28c0&amp;id=ca9d735d48"
            method="post"
            name="mc-embedded-subscribe-form"
            target="_blank"
            className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              name="EMAIL"
              placeholder="Your email"
              required
              aria-label="Your email"
              className="border-input bg-background flex-1 rounded-md border px-4 py-2"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 transition-colors"
            >
              Subscribe
            </button>

            {/* Hidden field for bot protection */}
            <div className="absolute -left-[5000px]" aria-hidden="true">
              <input
                type="text"
                name="b_54e732ed7896e81d21abf28c0_ca9d735d48"
                tabIndex={-1}
              />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SubscriptionSection;
