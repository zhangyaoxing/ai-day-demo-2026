// Fictional internal knowledge base for the demo product "Orbital".
// Each document is a list of self-contained text chunks; Atlas autoEmbed
// generates embeddings for the "text" field at index time.

export const corpus = [
  {
    docId: "overview",
    source: "overview",
    title: "Orbital Platform Overview",
    chunks: [
      {
        section: "What is Orbital",
        text: "Orbital is a data-observability platform that monitors the health, quality, and lineage of data pipelines in real time. It ingests logs, metrics, and metadata from your warehouse and streaming systems, then surfaces anomalies through a single dashboard. Teams use Orbital to detect schema drift, pipeline failures, and data freshness issues before they affect downstream consumers.",
      },
      {
        section: "Core capabilities",
        text: "Orbital's core capabilities are automated anomaly detection, data lineage visualization, freshness monitoring, and schema-change tracking. It connects natively to Snowflake, BigQuery, Datadog, PagerDuty, Slack, AWS CloudWatch, dbt, and Airflow, so teams can observe their stack without writing custom collectors.",
      },
    ],
  },
  {
    docId: "pricing",
    source: "pricing",
    title: "Orbital Pricing & Plans",
    chunks: [
      {
        section: "Plan overview",
        text: "Orbital offers three plans: Free, Pro, and Enterprise. All paid plans include a 14-day free trial with no credit card required, and you can change plans at any time with prorated billing.",
      },
      {
        section: "Free plan",
        text: "The Free plan costs $0 per month. It includes 1 million events per month, 30 days of data retention, community support, and access to the core dashboard. It does not include anomaly alerts, SSO, or cross-region failover.",
      },
      {
        section: "Pro plan",
        text: "The Pro plan costs $299 per month. It includes 10 million events per month, 90 days of data retention, automated anomaly alerts, and standard email support. Single sign-on (SSO) is available as an add-on for an additional $99 per month.",
      },
      {
        section: "Enterprise plan",
        text: "The Enterprise plan has custom pricing based on usage. It includes unlimited events, configurable data retention, access to the SOC 2 Type II report, a dedicated customer success manager, and premium 24/7 support with a 15-minute response time for severity-1 issues.",
      },
    ],
  },
  {
    docId: "release-notes",
    source: "release-notes",
    title: "Orbital Release Notes",
    chunks: [
      {
        section: "v3.4.2 — 2025-11-12",
        text: "Version 3.4.2 was released on November 12, 2025. This patch release fixed a bug where the dashboard took more than 10 seconds to load for accounts with over 50 saved dashboards. It also fixed a timezone offset issue that caused anomaly charts to display timestamps one hour off for customers in the Europe/Stockholm time zone.",
      },
      {
        section: "v3.4.0 — 2025-10-30",
        text: "Version 3.4.0 was released on October 30, 2025. The headline feature is Anomaly Watch, which uses machine learning to predict pipeline failures before they happen and proactively surface at-risk jobs.",
      },
      {
        section: "v3.3.0 — 2025-09-18",
        text: "Version 3.3.0 was released on September 18, 2025. It added Slack alert integration and generic webhook support, letting teams route Orbital alerts into their existing incident-response tooling.",
      },
    ],
  },
  {
    docId: "security",
    source: "security",
    title: "Security & Compliance",
    chunks: [
      {
        section: "Certifications",
        text: "Orbital is SOC 2 Type II certified. The most recent audit was completed in August 2025 by an independent Big Four accounting firm, and Orbital undergoes SOC 2 Type II audits annually.",
      },
      {
        section: "Additional standards",
        text: "In addition to SOC 2 Type II, Orbital is ISO 27001 certified and GDPR compliant. A Data Processing Agreement (DPA) is available for European Union customers upon request.",
      },
      {
        section: "Encryption & hosting",
        text: "All customer data is encrypted with AES-256 at rest and transmitted over TLS 1.3 in transit. Orbital hosts data in two regions: AWS us-east-1 for customers in the Americas and AWS eu-west-1 for customers in Europe.",
      },
    ],
  },
  {
    docId: "limits",
    source: "limits",
    title: "Orbital Known Limitations",
    chunks: [
      {
        section: "Ingestion",
        text: "The maximum ingestion rate is 100,000 events per second per account. Accounts that exceed this rate are throttled and receive an alert. Enterprise customers can request a higher limit through their customer success manager.",
      },
      {
        section: "Free plan limits",
        text: "The Free plan has a 30-day data lookback window, meaning data older than 30 days is not queryable. The Free plan also does not include cross-region failover. Cross-region failover is available on the Enterprise plan.",
      },
    ],
  },
  {
    docId: "support",
    source: "support",
    title: "Orbital Support & SLA",
    chunks: [
      {
        section: "Support tiers",
        text: "Orbital has three support tiers: Community (included with Free), Standard (included with Pro), and Premium (included with Enterprise). Community support is documentation and forum based.",
      },
      {
        section: "Response times",
        text: "Standard support responds within 4 business hours. Premium support is available 24/7 and responds within 15 minutes for severity-1 issues. Severity-1 is defined as a complete outage of the Orbital platform or total loss of data ingestion.",
      },
    ],
  },
  {
    docId: "integrations",
    source: "integrations",
    title: "Orbital Integrations",
    chunks: [
      {
        section: "Native integrations",
        text: "Orbital ships with native integrations for Snowflake, Google BigQuery, Datadog, PagerDuty, Slack, AWS CloudWatch, dbt, and Apache Airflow. Each integration is one-click from the Connections page and does not require a separate agent.",
      },
    ],
  },
  {
    docId: "faq",
    source: "faq",
    title: "Orbital FAQ",
    chunks: [
      {
        section: "Trial",
        text: "Can I try the Pro plan before buying? Yes, every paid plan includes a 14-day free trial and you do not need to enter a credit card to start the trial.",
      },
      {
        section: "Billing",
        text: "How is event volume calculated? Each ingested log line or metric point counts as one event. Duplicate events and internal system events do not count toward your monthly volume.",
      },
      {
        section: "Plan changes",
        text: "Can I change plans at any time? Yes, you can upgrade or downgrade at any time and billing is prorated automatically.",
      },
    ],
  },
  {
    docId: "company-history",
    source: "company-history",
    title: "Our Story",
    chunks: [
      {
        section: "Founding",
        text: "Orbital was founded in 2021 by two former data engineers who were frustrated with the lack of visibility into their production data pipelines. The company raised a seed round and is headquartered in San Francisco, California.",
      },
      {
        section: "Growth",
        text: "Today Orbital has about 120 employees and completed a Series B funding round in 2024. The platform now serves more than 900 customers across finance, healthcare, and e-commerce.",
      },
    ],
  },
  {
    docId: "industry-blog",
    source: "industry-blog",
    title: "The State of Data Observability in 2026",
    chunks: [
      {
        section: "Market trends",
        text: "The data-observability market has grown rapidly as companies adopt modern data stacks. Vendors typically price their platforms using tiered plans based on event volume and data retention, which is why pricing models vary widely across the industry.",
      },
      {
        section: "Why it matters",
        text: "Data pipelines are increasingly mission-critical, and the cost of downtime continues to rise. Observability tools help teams detect failures early, but choosing the right plan depends on ingestion rates and how much historical data the business needs to query.",
      },
    ],
  },
];
