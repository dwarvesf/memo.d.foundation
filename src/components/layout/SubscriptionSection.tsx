import React from 'react';

const SubscriptionSection: React.FC = () => {
  return (
    <section className="mt-16 py-12 border-t border-border">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-3">Get notified when we publish</h2>
          <p className="text-muted-foreground">Subscribe to get the latest posts by email.</p>
        </div>
        
        <div>
          <form 
            action="https://foundation.us19.list-manage.com/subscribe/post?u=54e732ed7896e81d21abf28c0&amp;id=ca9d735d48" 
            method="post" 
            name="mc-embedded-subscribe-form" 
            target="_blank"
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <input 
              type="email" 
              name="EMAIL" 
              placeholder="Your email" 
              required 
              aria-label="Your email" 
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background"
            />
            <button 
              type="submit" 
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Subscribe
            </button>
            
            {/* Hidden field for bot protection */}
            <div className="absolute -left-[5000px]" aria-hidden="true">
              <input type="text" name="b_54e732ed7896e81d21abf28c0_ca9d735d48" tabIndex={-1} />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SubscriptionSection;