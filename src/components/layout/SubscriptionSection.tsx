import React from 'react';

const SubscriptionSection: React.FC = () => {
  return (
    <div className="subscription">
      <div className="container">
        <div className="section-header">
          <h2>Get notified when we publish</h2>
          <p>Subscribe to get the latest posts by email.</p>
        </div>
        <div className="subscription-form">
          <form action="https://foundation.us19.list-manage.com/subscribe/post?u=54e732ed7896e81d21abf28c0&amp;id=ca9d735d48" method="post" name="mc-embedded-subscribe-form" target="_blank">
            <div className="form-inputs">
              <input type="email" name="EMAIL" placeholder="Your email" required aria-label="Your email" />
              <button type="submit" className="btn btn-primary">Subscribe</button>
            </div>
            <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
              <input type="text" name="b_54e732ed7896e81d21abf28c0_ca9d735d48" tabIndex={-1} />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSection;