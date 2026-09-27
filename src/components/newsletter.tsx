import {Button, Container} from "./ui";
export function Newsletter() {
 return <section className="newsletter"><Container className="newsletter-inner">
  <div><p className="eyebrow">STAY IN THE LOOP</p><h2>First to know.<br/>Never in the crowd.</h2></div>
  <div>
   <label htmlFor="newsletter-email">YOUR EMAIL</label>
   <div className="email-row"><input id="newsletter-email" type="email" disabled placeholder="Signup opens soon" aria-describedby="newsletter-note"/>
   <Button type="button" disabled aria-label="Newsletter signup unavailable">↗</Button></div>
   <p id="newsletter-note" className="muted">Newsletter signup is not available yet. No email addresses are collected here.</p>
  </div>
 </Container></section>;
}
