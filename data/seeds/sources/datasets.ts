/**
 * Dataset-modeled seed texts for the corpus (issue #14): 280 entries across the
 * five PRD-listed public sources. Every entry here is an ORIGINAL, style-modeled
 * composition — no text was copied from any upstream dataset — so the committed
 * artifact carries no third-party prose and no real PII by construction.
 *
 * Authoring rules (enforced by scripts/build-corpus.ts `check`):
 *   - the only `@` usage allowed is `<local>@example.com`; no other address form
 *   - phone numbers only as masked patterns (+234xxxxxxxxxx / 0803xxxxxxx)
 *   - no run of digits longer than 10 characters anywhere in a text
 *   - no quoted-header remnants, single-paragraph strings, ≤ 990 chars
 *
 * URLs in texts are example.com subdomains on purpose: the corpus is a sample,
 * not a live bad-link list (see PRD "Seed corpus sources" attribution table).
 */
import type { Category, Channel } from '../../../src/lib/constants';

/** One authored seed text; `category`/`channel` use the app's fixed vocabularies. */
export interface SeedText {
  readonly text: string;
  readonly category: Category;
  readonly channel: Channel;
  /** Popular scam → the build script samples its report_count high (25–90). */
  readonly popular?: boolean;
  /** Stable id for variant parents and popular entries; unique corpus-wide. */
  readonly key?: string;
}

/** A group of texts modeled on one upstream dataset, with its attribution line. */
export interface DatasetPool {
  readonly id: string;
  readonly source: string;
  readonly texts: readonly SeedText[];
}

// UCI SMS Spam Collection: prize/lottery/quiz SMS, abbreviated text style.
// Quota 75 = 67 `other` + 8 `phishing` (prize-claim variants asking for bank details).
const UCI_POOL: DatasetPool = {
  id: 'uci',
  source: 'UCI SMS Spam Collection (CC BY 4.0) — modeled entry, no copied upstream text, PII-free',
  texts: [
    { text: 'Congratulations! You have won a 2,000 dollars prize in our international lottery draw. Call 0905xxxxxxx now to claim your winnings before Friday.', category: 'other', channel: 'sms' },
    { text: 'URGENT! Your mobile number was selected in the annual phone draw. You have won a brand new car. Send your name and address to claim.', category: 'other', channel: 'sms', key: 'uci-vp-01' },
    { text: 'Free ringtone! Reply YES and we will send the top chart tones to your phone at no charge this week only.', category: 'other', channel: 'sms', key: 'uci-vp-02' },
    { text: 'You have been credited with 500 free text messages for being a loyal customer. Reply STOP to opt out. Msg and data rates may apply.', category: 'other', channel: 'sms' },
    { text: 'Win a weekend for two in a luxury hotel! Text WIN with your name to 8xxxx. Costs normal network rate.', category: 'other', channel: 'sms' },
    { text: 'Dating service: lonely singles in your area want to chat tonight. Call 0703xxxxxxx now, first five minutes free!', category: 'other', channel: 'sms', key: 'uci-vp-03' },
    { text: 'Your loan application of 50,000 has been pre-approved. No credit checks. Call now to receive funds within 24 hours.', category: 'other', channel: 'sms' },
    { text: 'Claims department: your unnamed prize is waiting. Call our claims line on 0871xxxxxxx between 9am and 7pm and quote reference KX-4471.', category: 'other', channel: 'sms', key: 'uci-vp-04' },
    { text: 'Congratulations! Your SIM entry made you a winner of an all-expenses-paid trip to Dubai. Text your full name to 3xxxx to claim.', category: 'other', channel: 'sms' },
    { text: 'Hot singles in your postcode are waiting. Send CHAT to 6xxxx and get matched instantly. 18 plus only.', category: 'other', channel: 'sms', key: 'uci-vp-05' },
    { text: 'This month winner alert: you! Claim your 100 free minutes by calling customer care on 0802xxxxxxx. Offer expires in 48 hours.', category: 'other', channel: 'sms' },
    { text: 'Lowest call rates ever! Subscribe now and call anywhere at half price. Dial *1xx# to activate today and get 10 bonus minutes.', category: 'other', channel: 'sms' },
    { text: 'You could win our monthly jackpot of one million naira. SMS your name and location to 33xxx. N50 per SMS applies.', category: 'other', channel: 'sms', key: 'uci-vp-06' },
    { text: 'Get 25 percent off on all prepaid bundles this weekend. Dial *2xx# and enjoy double data on every recharge.', category: 'other', channel: 'sms' },
    { text: 'Lucky dip draw! Your phone number has been shortlisted for the family car draw. Visit our office with any valid card to confirm.', category: 'other', channel: 'sms' },
    { text: 'CONGRATULATIONS, your mobile number has won you a cash prize of 200,000 in the MONI promo. For claims call 0810xxxxxxx now.', category: 'other', channel: 'sms', key: 'uci-vp-07' },
    { text: 'We have a gift for you! A free colour wallpaper and polyphonic ringtone. Download now at wap.smsfun.example.com', category: 'other', channel: 'sms' },
    { text: 'Congratulations, you have won a 1,000 shopping voucher. To claim, call 0705xxxxxxx and quote your winning code.', category: 'other', channel: 'sms' },
    { text: 'Meet new friends tonight! Send FRIEND to 7xxxx for instant chat with people near you. Standard rates apply.', category: 'other', channel: 'sms', key: 'uci-vp-08' },
    { text: 'Clear your debts today! We consolidate all your loans into one easy payment. Call our advisors free on 0800xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'You are our 1,000th caller! Your prize is a brand new television. Call back on the promo line within 10 minutes to collect.', category: 'other', channel: 'sms', key: 'uci-vp-09' },
    { text: 'Free entry! Text your favourite team name to 5xxxx for a chance to win signed club merchandise every week.', category: 'other', channel: 'sms' },
    { text: 'Special offer: get a brand new phone for half price when you port your number to us today. Dial *3xx# now.', category: 'other', channel: 'sms' },
    { text: 'Your account earns double points this month. Redeem airtime, data and gifts at our online store. Log in with your number.', category: 'other', channel: 'sms' },
    { text: 'Paid survey alert: earn 20,000 weekly working from your phone. No experience needed. Register free, call 0708xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'Congratulations! You have won two VIP tickets to the city carnival. Show this message at the gate with your ID.', category: 'other', channel: 'sms', key: 'uci-vp-10' },
    { text: 'Emergency cash in minutes! Text CASH with the amount you need and we transfer instantly. Repay on payday. Terms apply.', category: 'other', channel: 'sms' },
    { text: 'Ringtone blast! Top ten mixtapes now free for the next one hour. Reply with the artist name to get yours.', category: 'other', channel: 'sms' },
    { text: 'Win a laptop for your studies! Every top-up this month enters you into the Students Lucky Draw. Winners announced monthly.', category: 'other', channel: 'sms' },
    { text: 'Chat and flirt: hundreds of new members joined today. Call 0709xxxxxxx and leave a voice message for your match.', category: 'other', channel: 'sms' },
    { text: 'Insurance offer: life cover from just 1,500 monthly. SMS your name and age to 40xxx and an agent will call you.', category: 'other', channel: 'sms', key: 'uci-vp-11' },
    { text: 'You have a pending gift from your network. Answer three simple questions correctly to unlock 1GB of free data.', category: 'other', channel: 'sms' },
    { text: 'Cheap international calls! Talk to your family abroad for a flat rate. Dial the access number 0207xxxxxxx before the country code.', category: 'other', channel: 'sms' },
    { text: 'Loyalty reward: you have earned 300 points. Text REDEEM to 44xxx before month end or your points expire.', category: 'other', channel: 'sms' },
    { text: 'Congratulations, your phone number won the recharge-and-win promo. Call the claims agent on 0813xxxxxxx with your winning PIN.', category: 'other', channel: 'sms', key: 'uci-vp-12' },
    { text: 'University admission made easy! Not admitted? We process admissions into partner institutions. Call 0706xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'House cleaning services: trusted staff, sanitised tools. Book a cleaner today and get 20 percent off your first visit.', category: 'other', channel: 'sms' },
    { text: 'Buy one get one free on all spa treatments this week. Limited slots, call 0809xxxxxxx to reserve.', category: 'other', channel: 'sms' },
    { text: 'Weekly prize alert! One lucky texter wins a food hamper every Saturday. Text HAMPER with your name to 55xxx.', category: 'other', channel: 'sms' },
    { text: 'Quiz time! What is the capital of Germany? A) Munich B) Berlin C) Frankfurt. Text A, B or C to 21xxx. Win 10,000 if correct!', category: 'other', channel: 'sms', key: 'uci-vp-13' },
    { text: 'Mobile money: send and receive cash from any agent near you. Register today with just your phone number and a valid ID.', category: 'other', channel: 'sms' },
    { text: 'Need a mechanic, plumber or tailor? We connect you to verified artisans in your area in minutes. SMS your need to 505xx.', category: 'other', channel: 'sms' },
    { text: 'Congratulations! You are one of our ten lucky winners in the mid-week draw. Each winner gets 25,000 airtime credit.', category: 'other', channel: 'sms', popular: true, key: 'uci-pop-01' },
    { text: 'Late night chat with friendly locals. Call 0902xxxxxxx now, first 3 minutes free for new callers.', category: 'other', channel: 'sms' },
    { text: 'Win free fuel for a year! Send PUMP and your name to 60xxx. Winner announced on radio this Friday.', category: 'other', channel: 'sms' },
    { text: 'Double your data! Subscribe to any monthly plan and get the same volume free, instantly. Dial *4xx#.', category: 'other', channel: 'sms' },
    { text: 'Sell your old phone today! Instant cash offer in 2 minutes. SMS the model to 81xx and we call back with a price.', category: 'other', channel: 'sms' },
    { text: 'New: evening classes in catering, tailoring and computer basics. Register this week, pay half. Call the centre on 0807xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'Your voucher of 5,000 for the city food festival expires tomorrow. Present this message at any gate to redeem.', category: 'other', channel: 'sms' },
    { text: 'Win a generator set! Our dry-season promo rewards 20 winners weekly. Text GEN to 66xxx with your full name.', category: 'other', channel: 'sms', popular: true, key: 'uci-pop-02' },
    { text: 'Free medical check for the community this Saturday at the township hall. Free BP, sugar and malaria tests, all welcome.', category: 'other', channel: 'sms' },
    { text: 'Rent-to-own: get a fridge, TV or generator with a small weekly payment. No deposit. Call 0814xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'Astro readings: what do the stars say about your money and love life this month? Call 0701xxxxxxx for your free reading.', category: 'other', channel: 'sms' },
    { text: 'Congratulations on your car insurance renewal! Renew within 7 days and get a free road-safety kit for your vehicle.', category: 'other', channel: 'sms' },
    { text: 'We print branded nylon bags, cartons and bottles for your small business at factory prices. Call for a quote today.', category: 'other', channel: 'sms' },
    { text: 'Church programme: seven nights of miracles starts Friday at the crusade ground. Free transport from the motor park every evening.', category: 'other', channel: 'sms' },
    { text: 'Your phone model supports our new caller tunes. Press 8xx now to set your best-loved track as your caller ringback.', category: 'other', channel: 'sms' },
    { text: 'Water solutions: borehole drilling and tanker supply for estates at promo rates this month. Call 0805xxxxxxx.', category: 'other', channel: 'sms' },
    { text: 'Congratulations! Your friend recommended you for our borrow-me data plan. Accept 500MB now and repay on your next recharge.', category: 'other', channel: 'sms', key: 'uci-vp-14' },
    { text: 'Speed dating night at the city lounge this Saturday. Entry free for ladies, 2,000 for guys. Dress to impress!', category: 'other', channel: 'sms' },
    { text: 'Instant photo mugs and tees: send us your best picture and we deliver custom gifts in 48 hours. Call to order.', category: 'other', channel: 'sms' },
    { text: 'Raffle draw at the market square on Sunday: win a deep freezer and two bags of rice. Fill a ticket for 200.', category: 'other', channel: 'sms' },
    { text: 'Exam prep: past questions and answers for final-year examinations now on your phone. SMS your subject to 90xx.', category: 'other', channel: 'sms' },
    { text: 'Your network now covers the new estate road. Enjoy 4G speed and free video streaming all night from 12am to 6am.', category: 'other', channel: 'sms' },
    { text: 'Congratulations, your entry won a food basket from the community shop. Collect at plot 4, market road with this message.', category: 'other', channel: 'sms' },
    { text: 'Be your own boss: start a mini importation business with small capital. Free seminar Saturday, call 0806xxxxxxx to reserve a seat.', category: 'other', channel: 'sms', popular: true, key: 'uci-pop-03' },
    { text: 'Holiday special: two nights in the hill resort for the price of one. Book before Sunday, rooms are going fast.', category: 'other', channel: 'sms' },
    { text: 'You have won 750,000 in the bank customers promo. Send your account number and bank name to 0811xxxxxxx to receive payment.', category: 'phishing', channel: 'sms', key: 'uci-vp-15' },
    { text: 'Claim your prize of 300,000 dollars from the global email lottery! Send your bank name, account number and payment instructions to our claims office.', category: 'phishing', channel: 'sms' },
    { text: 'Your mobile number won the telecom mega draw. To transfer your winnings we need your account details; reply with bank, account number and holder name.', category: 'phishing', channel: 'sms' },
    { text: 'Attention winner! Your prize is ready but our bank needs a small processing fee first. Send 5,000 to the agent account 0123 4567 89, then call us.', category: 'phishing', channel: 'sms' },
    { text: 'WINNING NOTICE: your email address emerged first in our online draw. Reply with your full name, address, phone and bank particulars to claim 150,000 euros.', category: 'phishing', channel: 'sms', popular: true, key: 'uci-pop-04' },
    { text: 'Lucky winner, call 0909xxxxxxx now. Have your bank details ready, winners who fail to claim in 24 hours forfeit the prize.', category: 'phishing', channel: 'sms' },
    { text: 'Your phone has won a house in the estate draw. Send a scan of your ID and bank account to process the documents. Agent line: 0812xxxxxxx.', category: 'phishing', channel: 'sms' },
    { text: 'PRIZE CLAIM: you are among winners of 100,000. Forward your account number to this line so our paymaster can effect payment today.', category: 'phishing', channel: 'sms' },
  ],
};

// Apache SpamAssassin public corpus: 2002-era mail spam, longer bodies.
// Quota 42 = 12 phishing / 12 investment / 10 advance_fee / 8 other, all email.
const SPAMASSASSIN_POOL: DatasetPool = {
  id: 'spamassassin',
  source: 'Apache SpamAssassin public corpus — modeled entry, no copied upstream text, headers stripped, PII-free',
  texts: [
    { text: 'Dear customer, our records show your account was accessed from an unknown device. For your protection, verify your login details within 24 hours at trustpay-secure.example.com/verify or your service will be suspended.', category: 'phishing', channel: 'email', key: 'sa-vp-01' },
    { text: 'ATTENTION: Your internet banking profile expires today. Confirm your username, password and card PIN at safemail-banking.example.com update page. Failure to confirm means permanent closure of your profile. Security Department.', category: 'phishing', channel: 'email' },
    { text: 'We detected a failed sign-in attempt on your mailbox. Confirm your identity by replying with your email address and password so our security team can restore full access.', category: 'phishing', channel: 'email' },
    { text: 'Thank you for opening a WebBank business account. Before your first transfer, complete verification: send your account number, card expiry and security code to onboarding@example.com so our clearance team can confirm your profile.', category: 'phishing', channel: 'email' },
    { text: 'Your card was used in a foreign shop. If this was not you, freeze your account at the fraud desk, fraud-desk.example.com lookalike-check page, where you will be asked to confirm your card number and PIN to reverse the charge.', category: 'phishing', channel: 'email', key: 'sa-vp-02' },
    { text: 'Certificate of account upgrade: your Savings Plus account is due to expire. Re-activate now via the secure portal portal.example.com/activate and log in with your card PIN to keep your 4 percent interest rate.', category: 'phishing', channel: 'email' },
    { text: 'Payroll update: your salary account was migrated to the new payment platform. Log in at hr-portal.example.com/payroll with your staff ID and internet banking password to re-link your salary.', category: 'phishing', channel: 'email' },
    { text: 'Dear member, your subscription payment was declined. Update your payment card at accounts.example.com/billing or your mailbox will be closed in 48 hours. Customer Service.', category: 'phishing', channel: 'email' },
    { text: 'Important notice from the security department: we are upgrading all profiles to the new standard. Confirm your PIN and card number now, accounts not confirmed today will be restricted until Monday.', category: 'phishing', channel: 'email', key: 'sa-vp-03' },
    { text: 'Your email quota is full. Re-validate your mailbox at webmail.example.com/quota and enter your address and password to continue receiving mails without interruption.', category: 'phishing', channel: 'email' },
    { text: 'Tax refund notice: after the last calculations of your fiscal activity, a refund of 480 dollars is due to you. Submit your claim at revenue-refunds.example.com/claim with your bank routing details.', category: 'phishing', channel: 'email' },
    { text: 'Your online order cannot ship because the card on file was rejected by the bank. Re-enter your card number and security code at orders.example.com/payment-update to complete delivery.', category: 'phishing', channel: 'email' },
    { text: 'HOT STOCK ALERT: Phoenix Mineral Corp (PHXC) trades near its 52-week low of 0.35 and insiders are buying quietly. Put this on your watch list Monday morning, expected move to 1.20 within 30 days.', category: 'investment', channel: 'email', key: 'sa-vp-04' },
    { text: 'Exclusive tip: GoldenPeak Resources just struck a huge deposit. The big money is moving in quietly. Buy before the Thursday press release and ride the wave. Reply for the full report.', category: 'investment', channel: 'email' },
    { text: 'Our members made 47 percent in three weeks on our last pick. The next profile is out tonight: a small bio-stock with two pending patents. Join free and see why insiders accumulate now.', category: 'investment', channel: 'email' },
    { text: 'Do not miss this one: CareFree Medical holds a pending regulator decision. Similar plays returned 300 percent last quarter. Buy under 0.90, sell over 2.50. Full analysis attached on request.', category: 'investment', channel: 'email' },
    { text: 'SUBSCRIBER BRIEFING: management of StreamCast Media announced a share buy-back. The float is tiny; the price can double on one good week. Accumulate quietly and sell into strength.', category: 'investment', channel: 'email', popular: true, key: 'sa-pop-01' },
    { text: 'We profile companies before the crowd sees them. Today feature: NovaChip Semiconductors, revolutionary battery technology with first orders shipping. Current price 0.62, one-year target 3.00.', category: 'investment', channel: 'email' },
    { text: 'Dear investor, banks pay you 2 percent while inflation eats 9. Our managed commodity fund returned 31 percent last year, audited statements available. Minimum entry 500 dollars. Reply for the prospectus.', category: 'investment', channel: 'email', key: 'sa-vp-05' },
    { text: 'URGENT MARKET WIRE: merger talks confirmed between Hyperion Gear and an unnamed partner. Buy tomorrow at the open. Mergers like this one doubled holders money in two weeks.', category: 'investment', channel: 'email' },
    { text: 'Free options seminar: learn the strategy our students used to turn 2,000 into 18,000 in one year. Seats are limited in your city. Reply with your phone number for an invitation.', category: 'investment', channel: 'email' },
    { text: 'Under-the-radar gold play: LodeStar Mining sits on two million ounces of un-hedged reserves. At the current run rate the share trebles by the fourth quarter. Buy while institutions accumulate.', category: 'investment', channel: 'email' },
    { text: 'Weekly wealth letter: three trades, ten minutes a week. Last month picks gained 12, 9 and 15 percent. Reply TRIAL for the next issue free.', category: 'investment', channel: 'email' },
    { text: 'Pre-IPO allocation open: the social travel app with two million users is seeking quiet investors before listing. Minimum 5,000 dollars, projected five times at listing. Serious parties reply for the private placement memo.', category: 'investment', channel: 'email', key: 'sa-vp-06' },
    { text: 'Dear friend, I am a solicitor handling the estate of a late client whose surname matches yours. His bank holds 8.5 million dollars unclaimed. For a share, reply with your full name and private number for details.', category: 'advance_fee', channel: 'email', key: 'sa-vp-07' },
    { text: 'From the desk of the regional payments auditor: a contract over-invoicing of 12.5 million dollars is trapped in the apex bank. Assisting parties receive 30 percent. Send your banking coordinates for the transfer schedule.', category: 'advance_fee', channel: 'email' },
    { text: 'Beloved in Christ, I am a widow undergoing treatment and my doctors give me little time. I wish my late husband 4.2 million dollars to fund orphanages through you. Reply for my lawyer contact.', category: 'advance_fee', channel: 'email' },
    { text: 'RE: YOUR COMPENSATION FUND. The United Payments Council has approved your long-overdue compensation of 900,000 dollars. The release fee is 350 dollars, payable to the accredited agent listed below.', category: 'advance_fee', channel: 'email' },
    { text: 'Good day, I represent a deceased oil magnate whose next of kin cannot be traced. His deposit of 21 million dollars faces confiscation by the holding bank. Stand as next of kin and keep 40 percent.', category: 'advance_fee', channel: 'email' },
    { text: 'WINNING NOTIFICATION: your email was selected in the computer ballot of the International Awareness Promotion. Prize: 750,000 euros. Send your name, address, phone and occupation to the claims agent to process payment.', category: 'advance_fee', channel: 'email', popular: true, key: 'sa-pop-02' },
    { text: 'ASSISTANCE REQUIRED: a former government official moved 18 million dollars into a security company under a false name. Help us move it out in 10 working days; your reward is 25 percent and full protection.', category: 'advance_fee', channel: 'email' },
    { text: 'URGENT BUSINESS PROPOSAL: my client late father deposited 10.5 million in a fixed account before the civil crisis. As the family sole trustee abroad, I need a reliable partner to receive it. Your share: 35 percent.', category: 'advance_fee', channel: 'email' },
    { text: 'The audit committee of the petroleum board located double-debit entries worth 6 million dollars due for refund to any nominated account. Nominated partners receive 35 percent of the refund', category: 'advance_fee', channel: 'email', key: 'sa-vp-08' },
    { text: 'Dear beneficiary, your name appeared on the payment schedule of the Resettlement Commission. Unclaimed entitlements of 2.2 million dollars are forfeited to the treasury on Friday. Confirm your banking details today.', category: 'advance_fee', channel: 'email' },
    { text: 'Cheap software: full versions of office suites and design tools at 90 percent off retail. Instant download link after payment. Limited stock this week.', category: 'other', channel: 'email' },
    { text: 'Online pharmacy: sleep aid, pain relief and energy tablets without prescription. Discreet worldwide shipping. Order overnight at meds-express.example.com', category: 'other', channel: 'email', key: 'sa-vp-09' },
    { text: 'Lose 9 kilos in 14 days with the herbal patch, eat normally and no gym. Doctors in three countries endorse it. First-time buyers get a free month.', category: 'other', channel: 'email' },
    { text: 'Consolidate now and save: refinance your mortgage to 2.9 percent even with bad credit. Pre-approval takes 60 seconds by phone.', category: 'other', channel: 'email' },
    { text: 'Online casino: 200 dollars free chips on your first visit. Over 300 games, payouts in 24 hours. Lucky players win nightly jackpots.', category: 'other', channel: 'email' },
    { text: 'Get a verifiable university degree based on your life experience, no classes and no exams. Diplomas from accredited institutions in 7 days.', category: 'other', channel: 'email', key: 'sa-vp-10' },
    { text: 'Premium antivirus at a fraction of the store price: three computers, one licence, instant key. Renewal customers save an extra 15 percent this week.', category: 'other', channel: 'email' },
    { text: 'Free satellite TV for a year! Test our new decoder in your home, keep the dish and enjoy all movie channels during the trial period.', category: 'other', channel: 'email', popular: true, key: 'sa-pop-03' },
  ],
};

// Nigerian_Fraud.csv (rokibulroni/Phishing-Email-Dataset): classic 419 letters.
// Quota 26, all `advance_fee`, all email. Fictional names, masked contacts only.
const NIGERIAN_FRAUD_POOL: DatasetPool = {
  id: 'nigerian_fraud',
  source: 'Nigerian_Fraud.csv, rokibulroni/Phishing-Email-Dataset (CC BY-SA 4.0) — modeled entry, no copied upstream text, PII-free',
  texts: [
    { text: 'REQUEST FOR ASSISTANCE, STRICTLY CONFIDENTIAL. Dear Sir, I am Dr. Emeka Ubadike, director of contracts with a federal ministry. You may be surprised to receive this letter since we have not met before; I got your contact from a business directory. To cut the long story short, I have an over-invoiced contract sum of 15,500,000 dollars lying idle in the apex bank. Because civil servants are barred from operating foreign accounts, I need a reliable partner abroad to receive the funds. You will receive 30 percent for your assistance. Reply only to my confidential box: dr-emeka1@example.com', category: 'advance_fee', channel: 'email', key: 'nf-vp-01' },
    { text: 'My name is Mrs. Grace Alabi, widow of the late Chief Samuel Alabi of the cocoa merchants association. Before he died of the brief sickness, he kept 6.5 million dollars an investment company kept for him abroad. Our family lawyer says the money will be confiscated if an outsider does not help us move it. I have decided to offer you 30 percent for standing as the overseas partner in the transfer documents. Please reply through my personal box: mrsgrace2@example.com so we can begin.', category: 'advance_fee', channel: 'email', popular: true, key: 'nf-pop-01' },
    { text: 'Dear Friend, I am Barrister Uchenna Nwosu, counsel to the estate of a foreign contractor who worked with the water board for twelve years. He died with his whole family in the plane disaster of last year, leaving a deposit of 9.2 million dollars without a will. The bank gave my chambers a deadline to present any business partner of the deceased. Since you carry a similar foreign profile, I want you to stand forward as the business partner and collect the deposit with me. We share it 50-50. Reply urgently.', category: 'advance_fee', channel: 'email', key: 'nf-vp-02' },
    { text: 'URGENT BUSINESS: A metal box containing 12 million dollars in hundred-dollar bills was evacuated from a troubled province and has been deposited with a security company here in Lagos under a diplomatic cover. My colleagues in the arrangement need a trustworthy foreign partner in whose account the money will be swapped into. The content must leave the country within 21 days. Your reward is 35 percent, and every document that protects you will be provided. Contact me on +234xxxxxxxxxx or reply this box.', category: 'advance_fee', channel: 'email' },
    { text: 'From the desk of the private banking officer. Good day, I manage the portfolio of a late customer whose account now carries 4.8 million dollars. He has no next of kin on record, and our policy will declare the account dormant by the end of the quarter. I propose that you indicate interest as his next of kin so the funds are released to you. We shall share the money 60 to 40 in my favour. All that is needed from you is your identification and an account that can receive the transfer.', category: 'advance_fee', channel: 'email', key: 'nf-vp-03' },
    { text: 'Dear Sir, I am the chairman of the contract review committee of a government agency. In the course of our work we discovered an over-payment of 7.3 million dollars made to a supply company that has since folded up. The committee can vote the refund to any account presented by a claimant. I therefore invite you to act as the represented party of that company. My colleagues and I will guide the papers; you keep 25 percent after the bank transfers the refund.', category: 'advance_fee', channel: 'email' },
    { text: 'Beloved Partner, greetings in the name of humanity. I am a dying philanthropist under medical care abroad. It is my wish that my remaining wealth of 11 million dollars is used to build motherless babies homes through a trustworthy hand. My solicitors say only a foreign trustee can receive the money without government interference. If you accept this call of service, reply and I will connect you with the chambers handling the bequest. Everything is already deeded in your favour as trustee.', category: 'advance_fee', channel: 'email' },
    { text: 'CONFIDENTIAL DEAL: My uncle was a diamond merchant in a war zone before the crisis. He escaped with 750 karats of uncut stones now lodged in a vault in a neighbouring country under my late cousin name. We need a buyer-partner who will clear and market the stones abroad. All we ask is that you process the vault release and customs, and you keep 40 percent of the first sale. Serious enquiries only; reach me on +234xxxxxxxxxx any time.', category: 'advance_fee', channel: 'email' },
    { text: 'Dear Partner, our ministry awarded a contract for the supply of armoured vehicles at 46 million dollars. The suppliers delivered at 37.4 million, leaving a difference of 8.6 million dollars deliberately left in the budget. As the accounting officer I can only move this difference through a foreign contractor invoice. Assist us with an account and receive 30 percent. Documents proving the contract and the balance are ready for your lawyer.', category: 'advance_fee', channel: 'email', key: 'nf-vp-04' },
    { text: 'I am Capt. Dapo Ogunwale (rtd), executor of the will of my late friend who owned an oil servicing firm. His escrow account in a trust bank holds 13 million dollars reserved for his children, who died childless in an accident. The will empowers the executor to donate the fund to any credible person of African descent who will use it for skill-acquisition centres. If you can manage this trust honestly, reply and my lawyer will forward the claim form.', category: 'advance_fee', channel: 'email' },
    { text: 'Dear Madam, permit me to confide in you. My husband was a wealthy transporter before the road accident took him and our two sons. Unknown to the family, he kept 3.6 million dollars in a private vault under an agreement company. The vault office demands an overseas guardian account before releasing the contents, because the money was registered in trust for a foreign partner. I have searched for a reliable adopted sister abroad and your profile convinced me. Help me and take 35 percent.', category: 'advance_fee', channel: 'email' },
    { text: 'CLAIM NOTICE FROM THE CLAIMS UNIT. Our records show that a group life policy bought by a late foreign engineer matured at 2.9 million dollars with no beneficiary presentation since his passing eight years ago. The statute allows claims until the end of this financial year, after which the fund reverts to the pool. We require a claimant who can produce proof of partnership with the deceased. Our office will provide the notarised papers. Your share of settlement: 40 percent.', category: 'advance_fee', channel: 'email', key: 'nf-vp-05' },
    { text: 'Central bank review: during the reconciliation of dormant accounts, 21 balances totalling 19 million dollars were identified for sweep into the treasury. One of the accounts, carrying 4.1 million dollars, carries a name very close to your own description. The account must show fresh next-of-kin documents before Friday to escape the sweep. Present yourself through our chamber and we shall file the kinship affidavit for you immediately.', category: 'advance_fee', channel: 'email' },
    { text: 'STRICTLY FOR A RELIABLE PARTNER. A general of a neighbouring republic died leaving gold consignments sealed in a vault in Europe. His cronies cannot reach the vault because the access code is with his lawyer who died too. The Swiss vault rule allows the next beneficiary two attempts. My family has the ownership documents but no foreign face. Bring your good name, we bring the documents: proceeds shared 45 to 55 in your favour after the sale.', category: 'advance_fee', channel: 'email' },
    { text: 'Dear friend, I am Mrs. Janet Ede, treasurer of a resettlement cooperative for returnee families. Through the compensation board we received grants running into 5.4 million dollars, but the board insists the money leaves through a foreign partner account of one registered member living abroad. You shall be presented as our overseas-registered member. For standing with 240 families you keep 20 percent of every transfer cycle, starting with 900,000 dollars in the first batch.', category: 'advance_fee', channel: 'email' },
    { text: 'My name is Alhaji Sule Gwarzo. I control the rental proceeds of my late brother estates in the capital city, amounting to 1.9 million dollars kept in a fixed deposit. Our custom does not allow a man to inherit his elder brother property, so the money must pass through an unrelated party outside the country. I have chosen you after prayers and enquiry. Send nothing to nobody; only your bank coordinates to begin. You will get 30 percent of the transfer.', category: 'advance_fee', channel: 'email', popular: true, key: 'nf-pop-02' },
    { text: 'FROM THE PROCUREMENT DESK: A peace-support council awarded our firm a supply contract for relief materials at 22 million dollars. The team over-invoiced by 5.5 million dollars for logistics that were never utilised. The council auditor demands a beneficiary account abroad that the difference can be cleared into. As the nominated beneficiary you sign nothing and risk nothing; the paperwork is ours. Your reward: 30 percent of the cleared difference within 14 days of the transfer.', category: 'advance_fee', channel: 'email' },
    { text: 'Dear Sir, my family runs an export business that was suspended after the port crisis. Goods worth 2.2 million dollars are trapped in bonded warehouses, and the customs notice says unclaimed goods will be auctioned in 30 days. We want a foreign partner whose company can appear as the consignee and pay a small release deposit of 45,000 dollars which will be refunded with the first sale. Your ultimate gain is a standing partnership of 30 percent on all future shipments.', category: 'advance_fee', channel: 'email' },
    { text: 'FROM THE VESTRY DESK, WITH BLESSINGS. The late archbishop of our province bequeathed his personal donation fund of 3.3 million dollars to charity works outside the country. The synod committee cannot move the money because every trustee is a local cleric under the financial rules. The will names any communicant of good standing anywhere in the world as co-trustee. If you accept the trusteeship, the bank will transfer to your account the whole fund for you to administer with our synod.', category: 'advance_fee', channel: 'email' },
    { text: 'CONFIDENTIAL PROPOSAL: consignments of relief materials sent to the sub-region were converted to cash by officials of the receiving agency. The converted sum, 7.8 million dollars, is lying with a finance house awaiting a claimant sanctioned by the donor country. My colleagues and I control the claim file. We shall present you as the civil-society beneficiary. Your part: provide the receiving account and a bond of good conduct; your gain: 35 percent.', category: 'advance_fee', channel: 'email', key: 'nf-vp-06' },
    { text: 'Dear friend in business, I manage claims for an underwriting firm. A marine cargo policy of a deceased importer has remained unpresented for six years; the insured value with accumulated premiums stands at 5.7 million dollars. The claims window closes this fiscal year. A partner abroad must present as the consignee broker. We have every certification except a foreign face. Come with us and the settlement is shared 40 to 60 in your favour.', category: 'advance_fee', channel: 'email' },
    { text: 'SOLICITATION FOR TRUSTEESHIP: I am the eldest son of a late professor of economics who left 2.5 million dollars in a scholarship trust. The university that should administer it has been closed by strikes, and the will directs that if the institution cannot act, a private individual of learning may hold the fund in trust. I seek a partner of education abroad to be that trustee. You will manage the fund and retain 30 percent for your administration and trouble.', category: 'advance_fee', channel: 'email' },
    { text: 'URGENT MEDICAL SUPPLY CONTRACT, MINISTRY OF HEALTH. The vendors for the supply of medical kits failed to deliver, yet budget of 14 million dollars was already appropriated. A fresh vendor invoice of 9 million covers the true cost, leaving 5 million dollars as unspent balance that must be cleared out before the fiscal audit. A foreign account is required. Nominated account holders receive 25 percent after clearance, which takes one banking week. Reply with your direct line.', category: 'advance_fee', channel: 'email', key: 'nf-vp-07' },
    { text: 'Dear Partner, I won 9 million dollars in an overseas lottery through my cousin who works in the claims office, but our exchange control forbids receiving such sums locally. I want the winnings shifted into your account abroad where I can freely use them. For being the receiving channel you get 30 percent. No documents will ever carry your name beyond the ordinary bank forms. Answer me quickly because the claiming deadline runs out on the last day of this month.', category: 'advance_fee', channel: 'email' },
    { text: 'ASSISTANCE TO ESTABLISH A JOINT VENTURE. My family controls shipping agency rights in two coastal terminals. We have secured a concession worth 40 million dollars over five years, but the consortium rules require a foreign co-venturer who demonstrates 7 million dollars of account balance. We only need a temporary account showing the balance; no money moves. As the co-venturer of record you earn 35 percent of the concession profits and full protection under the agreement.', category: 'advance_fee', channel: 'email', key: 'nf-vp-08' },
    { text: 'Dear Sir, forgive my stranger approach. I am the personal assistant to a toppled officeholder who stashed 16.5 million dollars with a private security firm before the change of power. The firm releases consignments only to a named diplomatic receiver. The family wants the treasure recovered before the panel sitting seizes it. If your country permits you to receive a diplomatic box, stand as the receiver. The family offers 30 percent and a life-time consultancy for your discretion.', category: 'advance_fee', channel: 'email' },
  ],
};

// Nazario.csv (rokibulroni/Phishing-Email-Dataset): verify-within-24h brand phish.
// Quota 16, all `phishing`, all email, example.com links only.
const NAZARIO_POOL: DatasetPool = {
  id: 'nazario',
  source: 'Nazario.csv, rokibulroni/Phishing-Email-Dataset (CC BY-SA 4.0) — modeled entry, no copied upstream text, PII-free',
  texts: [
    { text: 'Dear customer, unusual activity was noticed on your payments account. To lift the limitation, restore full access within 24 hours at account-access.example.com/restore, where you confirm your password and card details. We are sorry for any inconvenience.', category: 'phishing', channel: 'email', key: 'naz-vp-01' },
    { text: 'We are upgrading our mail servers to the new secure standard. All staff mailboxes must be re-validated within 24 hours, otherwise the mailbox will be deleted with all folders. Validate your mailbox at webmail-upgrade.example.com/reset. Mail Systems Team.', category: 'phishing', channel: 'email', key: 'naz-vp-02' },
    { text: 'Dear Valued Member, we locked your trading account due to several failed login attempts. Unlock your account in the next 24 hours at secure-login.example.com/unlock using your secret question answer and PIN. Accounts stay locked after the deadline.', category: 'phishing', channel: 'email' },
    { text: 'Your tax refund of 632 dollars was approved but could not be delivered to your bank. Claim within 24 hours at refunds-portal.example.com/claim and submit your bank routing number and account. Claims amounts are voided after the window.', category: 'phishing', channel: 'email', popular: true, key: 'naz-pop-01' },
    { text: 'Your e-currency account will be deactivated for inactivity on Friday. Keep your balance and history by verifying your passphrase and secondary contact at e-vault.example.com/verify before the deadline. administration', category: 'phishing', channel: 'email' },
    { text: 'Message from the help desk: your network password expires tonight. Renew your password at portal-cs.example.com/renew using your current password, or lose access to all shared drives by morning. Reply HELP for assistance.', category: 'phishing', channel: 'email', key: 'naz-vp-03' },
    { text: 'Your bank card was blocked after three failed PIN attempts at an ATM in another city. If you did not make these attempts, unblock your card now at card-reactivate.example.com/unblock. The bank never calls for card details.', category: 'phishing', channel: 'email' },
    { text: 'We received a request to reset your password from a device in a foreign country. If this was not you, secure your account within 24 hours at guard-desk.example.com/report by confirming your login and backup question.', category: 'phishing', channel: 'email' },
    { text: 'Confirm your identity to receive your student loan disbursement of 3,200 dollars. The aid portal, portal-aid.example.com/kyc, asks for your student number and bank login. Confirm before midnight tomorrow or the disbursement returns to the pool.', category: 'phishing', channel: 'email' },
    { text: 'Your hosting account will be suspended for an unpaid balance of 19 dollars. Settle now and confirm your card details at bill-center.example.com/pay to avoid downtime of your websites and mail.', category: 'phishing', channel: 'email', key: 'naz-vp-04' },
    { text: 'License verification: your business e-license lapses in 24 hours. Upload your documents and pay the 25 dollar renewal at e-license.example.com/renew to keep trading legally. Unverified businesses are delisted.', category: 'phishing', channel: 'email' },
    { text: 'Your medical insurance card is expiring today. Re-activate it at health-portal.example.com/renew with your member ID, card number and PIN before the deadline, or clinics will bill you directly.', category: 'phishing', channel: 'email', popular: true, key: 'naz-pop-02' },
    { text: 'Remote update: our dispatch system shows two undelivered parcels under your name registered in another state. Verify the shipment and your current address at parcels-tracking.example.com/confirm within 24 hours so no package is lost.', category: 'phishing', channel: 'email' },
    { text: 'Your line will be disconnected for incomplete subscriber records within 24 hours. Complete your verification at line-verify.example.com/submit or the network removes your number from service tonight.', category: 'phishing', channel: 'email', key: 'naz-vp-05' },
    { text: 'Weekly payroll processing failed for your employee number: account number mismatch at the clearing house. Fix it within 24 hours at payroll-fix.example.com/bank-update by filing your correct account and routing numbers.', category: 'phishing', channel: 'email' },
    { text: 'Your cloud drive will be emptied tomorrow for a system audit. Preserve your files by confirming your login at cloud-keep.example.com/confirm today. Items not preserved cannot be recovered.', category: 'phishing', channel: 'email' },
  ],
};

// electricsheepafrica/africa-smishing-sms-phishing: 2023-25 Nigerian bank-app /
// BVN / mobile-money SMS phish + promo spam. Quota 21 = 14 phishing + 7 other, all sms.
const AFRICA_SMISHING_POOL: DatasetPool = {
  id: 'africa_smishing',
  source: 'electricsheepafrica/africa-smishing-sms-phishing (HF) — modeled entry, PII-free',
  texts: [
    { text: 'GTBank: Dear customer, ur mobile app is outdated and will STOP working 2day due 2 d new GTWorld upgrade. Migrate now: gtb-upgrade.example.com/app 2 keep ur acct active.', category: 'phishing', channel: 'sms', key: 'af-vp-01' },
    { text: 'CBN NOTICE: All bank accounts must be re-linked 2 a valid BVN b4 2moro 9am or d account wil be frozen. Re-link now: bvn-relink.example.com/cbn', category: 'phishing', channel: 'sms', key: 'af-vp-02' },
    { text: 'OPay: Your wallet is due 4 d new OPay-Pay upgrade. Old wallets won\'t send or receive money again 2day. Upgrade at opay-upgrade.example.com/wallet', category: 'phishing', channel: 'sms', popular: true, key: 'af-pop-01' },
    { text: 'ACCESS BANK: Ur ATM card was blocked after a withdrawal attempt of N60,000 in a far state. If no be u, unblock am now at access-unblock.example.com/atm b4 dem clear ur money.', category: 'phishing', channel: 'sms', popular: true },
    { text: 'NIN-SIM: Nationwide directive: MTN lines without NIN linkage go off at 6PM 2day. Link ur NIN in 2mins: nin-link.example.com/sim or lose ur number.', category: 'phishing', channel: 'sms', key: 'af-vp-03' },
    { text: 'NIGERIA IMMIGRATION: Ur passport renewal was approved but pending payment of d expedited fee. Complete at passport-fee.example.com/nga b4 d slot closes.', category: 'phishing', channel: 'sms' },
    { text: 'CBN COMPENSATION: D apex bank is paying old bank customers N75,000 each 4 d failed bank settlement. Claim urs: cbn-payout.example.com/comp — closes 2day 6pm.', category: 'phishing', channel: 'sms', popular: true, key: 'af-pop-02' },
    { text: 'FEDERAL SCHOLARSHIP: Undergraduate grant of N200,000 per session is open. Apply in 2mins: fed-scholar.example.com/apply — shortlist closes dis week.', category: 'phishing', channel: 'sms', key: 'af-vp-04' },
    { text: 'IKEDC: Ur prepaid meter is due 4 d new meter upgrade. Old meter tokens won\'t load after 2day. Upgrade ur meter: meter-upgrade.example.com/ikeja', category: 'phishing', channel: 'sms', key: 'af-vp-05' },
    { text: 'LOANPDEN: Final notice! Ur overdue loan attracts daily penalty and ur contacts will be messaged. Clear now at loan-fine.example.com/pay or face d consequences.', category: 'phishing', channel: 'sms' },
    { text: 'Access Bank: Ur account is temporarily frozen due 2 failed KYC verification. Update ur records at access-kyc.example.com/fix immediately.', category: 'phishing', channel: 'sms', key: 'af-vp-06' },
    { text: 'Kuda: New device logged into ur acct o. If no be u, lock ur acct now at kuda-lock.example.com/secure b4 dem clear am.', category: 'phishing', channel: 'sms', key: 'af-vp-07' },
    { text: 'UBA: Congratulations! U don win d UBA customer promo. Claim ur 1,000,000 within 24hrs at uba-claims.example.com/win — enter ur acct PIN 4 instant credit.', category: 'phishing', channel: 'sms', popular: true, key: 'af-pop-03' },
    { text: 'FRSC DRIVER\'S LICENCE: Ur licence is flagged 4 expiry correction. Renew online in 3mins at licence-fix.example.com/frsc or pay penalty at checkpoint.', category: 'phishing', channel: 'sms', key: 'af-vp-08' },
    { text: 'Happy new month! Recharge 1,000 and get 2,500 bonus data dis weekend. Dial *6xx# now. Terms and conditions apply.', category: 'other', channel: 'sms', key: 'af-vp-09' },
    { text: 'Do u need urgent cash? Get 50k to 500k in 5mins with no collateral. Download QuickNaira loan app or call 0809xxxxxxx. Interest from 4 percent monthly.', category: 'other', channel: 'sms' },
    { text: 'BETA LIFE PROMO: Text BETA 2 33xxx and stand a chance 2 win a tricycle dis December. N100 per SMS. Winners go b contacted.', category: 'other', channel: 'sms' },
    { text: 'Welcome 2 d new month bonus! U\'ve earned 1GB free data. Activate b4 2moro at mydata-bonus.example.com/claim', category: 'other', channel: 'sms', key: 'af-vp-10' },
    { text: 'Land for sale! Two plots at Ibeju-Lekki with registered survey. Inspection dis Saturday. Call 0805xxxxxxx for directions.', category: 'other', channel: 'sms' },
    { text: 'Aso-ebi fabrics at 3,500 per yard, free delivery within Lagos on orders above 20,000. WhatsApp us on 0803xxxxxxx 2 pick ur colours.', category: 'other', channel: 'sms' },
    { text: 'Fuel scarcity special: order petrol in drums for ur generator, delivered 2 ur site in 24hrs. Call 0703xxxxxxx. Payment on delivery.', category: 'other', channel: 'sms' },
  ],
};

/** The five dataset-modelled pools, in fixed assembly order (see build-corpus.ts). */
export const DATASET_POOLS = [UCI_POOL, SPAMASSASSIN_POOL, NIGERIAN_FRAUD_POOL, NAZARIO_POOL, AFRICA_SMISHING_POOL] as const satisfies readonly DatasetPool[];
