import React, { useState } from "react";
import { money } from "./ui.jsx";
export default function ReceiptForm({ refill, office, run, busy }) {
  const [amount, setAmount] = useState(""),
    [receiptRef, setReceipt] = useState("mock://receipt.png");
  const [items, setItems] = useState([{ name: "", qty: 1 }]),
    [error, setError] = useState("");
  const [imageName, setImageName] = useState("");
  function update(index, key, value) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }
  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2_000_000
    ) {
      setError("Choose a PNG, JPEG or WebP receipt under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceipt(reader.result);
      setImageName(file.name);
      setError("");
    };
    reader.onerror = () =>
      setError("The image could not be read. Please try again.");
    reader.readAsDataURL(file);
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError("Use a positive amount with at most two decimal places.");
      return;
    }
    // Parse decimal text as minor units without floating-point multiplication.
    const [whole, fraction = ""] = amount.split(".");
    const amountMinor = Number(
      BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")),
    );
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    await run(
      {
        action: "receipt",
        refillId: refill.id,
        employeeId: refill.committedBy,
        receipt: {
          amountMinor,
          currency: office.currency,
          receiptRef,
          items: items.map((i) => ({ name: i.name, qty: Number(i.qty) })),
        },
      },
      "Receipt recorded. The claim was submitted to HR or routed for admin approval.",
    );
  }
  return (
    <form onSubmit={submit} className="receipt-form">
      <fieldset disabled={busy}>
        <h3>Finish the refill</h3>
        <p className="muted">
          Add the purchase details. We’ll prepare the HR claim for you.
        </p>
        <div className="form-grid">
          <label>
            Amount paid ({office.currency})
            <input
              inputMode="decimal"
              required
              placeholder={office.id === "oslo" ? "900.00" : "2000.00"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <small>
              Per-refill cap: {money(office.refillCap, office.currency)}
            </small>
          </label>
          <label>
            Receipt image <span className="optional">optional in demo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
            <small>
              {imageName || "No upload? A simulated receipt reference is used."}
            </small>
          </label>
        </div>
        {imageName && (
          <img
            className="receipt-preview"
            src={receiptRef}
            alt="Selected receipt preview"
          />
        )}
        <div className="item-labels">
          <span>Items bought</span>
          <span>Quantity</span>
        </div>
        {items.map((item, i) => (
          <div className="item-row" key={i}>
            <input
              aria-label={"Item " + (i + 1) + " name"}
              required
              maxLength={80}
              placeholder="e.g. Mixed nuts"
              value={item.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <input
              aria-label={"Item " + (i + 1) + " quantity"}
              type="number"
              min="1"
              step="1"
              required
              value={item.qty}
              onChange={(e) => update(i, "qty", e.target.value)}
            />
            <button
              type="button"
              aria-label={"Remove item " + (i + 1)}
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="text-button"
          type="button"
          onClick={() => setItems([...items, { name: "", qty: 1 }])}
        >
          + Add another item
        </button>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="form-footer">
          <small>Over the cap? Your admin can review it.</small>
          <button className="primary" type="submit">
            Submit receipt →
          </button>
        </div>
      </fieldset>
    </form>
  );
}
