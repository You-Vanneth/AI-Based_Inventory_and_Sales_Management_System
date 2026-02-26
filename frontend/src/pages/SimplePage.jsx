import React from "react";
import Layout from "../components/Layout";
import { t } from "../lib/i18n";

export default function SimplePage({ title, description }) {
  return (
    <Layout title={title}>
      <section className="hero">
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
      </section>
      <section className="card">
        <p>{t("This page is ready to connect to API next.")}</p>
      </section>
    </Layout>
  );
}
