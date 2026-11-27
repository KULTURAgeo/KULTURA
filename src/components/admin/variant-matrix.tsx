"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { saveVariantMatrix } from "@/app/admin/products/variant-actions";
import { STANDARD_SIZES, defaultBaseSku, defaultSwatch, makeVariantSku, optionKey, orderSizes, variantOptionKey } from "@/lib/variant-options";
import styles from "./variant-matrix.module.css";

type Color = { name: string; hex: string | null; sort_position: number };
type Variant = {
  id: string | null; updated_at: string | null; color: string; size: string; sku: string;
  stock_quantity: number | string; is_active: boolean; sort_position: number;
};
type SavedVariant = Variant & { id: string; updated_at: string; stock_quantity: number };
const STARTER_COLORS = ["Black", "Brown", "White", "Gray", "Navy", "Beige"];

export function VariantMatrix({ productId, updatedAt, slug, savedBaseSku, savedColors, variants }: {
  productId: string; updatedAt: string; slug: string; savedBaseSku: string | null;
  savedColors: Color[]; variants: SavedVariant[];
}) {
  const [baseSku, setBaseSku] = useState(savedBaseSku ?? defaultBaseSku(slug));
  const [rows, setRows] = useState<Variant[]>(variants);
  const [colors, setColors] = useState(() => {
    const palette = new Map(savedColors.map((color) => [optionKey(color.name), color]));
    for (const name of [...variants.map((row) => row.color), ...STARTER_COLORS]) {
      const key = optionKey(name);
      if (!palette.has(key)) palette.set(key, { name, hex: null, sort_position: palette.size });
    }
    return [...palette.values()];
  });
  const [sizes, setSizes] = useState(() => orderSizes([...variants.map((row) => row.size), ...STANDARD_SIZES]));
  const [chosenColors, setChosenColors] = useState(() => [...new Set(variants.map((row) => optionKey(row.color)))]);
  const [chosenSizes, setChosenSizes] = useState(() => [...new Set(variants.map((row) => optionKey(row.size)))]);
  const [colorDraft, setColorDraft] = useState("");
  const [sizeDraft, setSizeDraft] = useState("");
  const [notice, setNotice] = useState("");

  const originalById = new Map(variants.map((row) => [row.id, row]));
  const rowsByOption = new Map(rows.map((row) => [variantOptionKey(row.color, row.size), row]));
  const rowColors = new Set(rows.map((row) => optionKey(row.color)));
  const matrixSizes = orderSizes(rows.map((row) => row.size));
  const matrixColors = colors.filter((color) => rowColors.has(optionKey(color.name)));
  const changes = rows.filter((row) => {
    const original = originalById.get(row.id ?? "");
    return !original || original.sku !== row.sku || String(original.stock_quantity) !== String(row.stock_quantity) || original.is_active !== row.is_active;
  });
  const storedColors = new Map(savedColors.map((color) => [optionKey(color.name), color]));
  const colorChanges = matrixColors.flatMap((color, index) => {
    const saved = storedColors.get(optionKey(color.name));
    return saved?.hex === color.hex && saved.sort_position === index ? [] : [{ ...color, sort_position: index }];
  });

  function toggle(value: string, selected: string[]) {
    return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
  }

  function addColor() {
    const name = colorDraft.trim();
    if (!name) return;
    const key = optionKey(name);
    if (!colors.some((color) => optionKey(color.name) === key)) {
      setColors([...colors, { name, hex: null, sort_position: colors.length }]);
    }
    if (!chosenColors.includes(key)) setChosenColors([...chosenColors, key]);
    setColorDraft("");
  }

  function addSize() {
    const size = sizeDraft.trim().toUpperCase();
    if (!size) return;
    if (!sizes.some((item) => optionKey(item) === optionKey(size))) setSizes(orderSizes([...sizes, size]));
    if (!chosenSizes.includes(optionKey(size))) setChosenSizes([...chosenSizes, optionKey(size)]);
    setSizeDraft("");
  }

  function generate() {
    const usedSkus = new Set(rows.map((row) => row.sku));
    const generated: Variant[] = [];
    const selectedSizes = sizes.filter((item) => chosenSizes.includes(optionKey(item)));
    for (const color of colors.filter((item) => chosenColors.includes(optionKey(item.name)))) {
      for (const size of selectedSizes) {
        if (rowsByOption.has(variantOptionKey(color.name, size))) continue;
        const sku = makeVariantSku(baseSku, color.name, size, usedSkus);
        usedSkus.add(sku);
        generated.push({ id: null, updated_at: null, color: color.name, size, sku,
          stock_quantity: 0, is_active: true, sort_position: rows.length + generated.length });
      }
    }
    if (generated.length + changes.length > 180) {
      setNotice("Choose fewer combinations and save in batches of up to 180 changes.");
      return;
    }
    setRows([...rows, ...generated]);
    setNotice(generated.length ? `Added ${generated.length} combinations. Enter stock and save all.` : "All selected combinations already exist.");
  }

  function updateRow(row: Variant, changes: Partial<Variant>) {
    setRows((previous) => previous.map((item) => item === row ? { ...item, ...changes } : item));
  }

  return (
    <section className="panel" aria-labelledby="variant-matrix-heading">
      <h2 id="variant-matrix-heading">VARIANTS &amp; INVENTORY</h2>
      <ActionForm action={saveVariantMatrix} label="SAVE ALL VARIANTS">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="updated_at" value={updatedAt} />
        {colorChanges.map((color) => <input key={color.name} type="hidden" name="color" value={JSON.stringify(color)} />)}
        {changes.map((row) => <input key={variantOptionKey(row.color, row.size)} type="hidden" name="variant" value={JSON.stringify(row)} />)}
        <label className="k-field">
          <span>BASE SKU</span>
          <input name="base_sku" value={baseSku} onChange={(event) => setBaseSku(event.target.value.toUpperCase())}
            required maxLength={40} pattern="[A-Z0-9][A-Z0-9_\\-]{0,39}" />
        </label>
        <div className={styles.options}>
          <div role="group" aria-label="Colors to generate">
            <h3>COLORS</h3>
            <div className={styles.chips}>
              {colors.map((color) => <button key={optionKey(color.name)} type="button"
                aria-pressed={chosenColors.includes(optionKey(color.name))}
                onClick={() => setChosenColors(toggle(optionKey(color.name), chosenColors))}>
                <span className={styles.swatch} aria-hidden="true" style={{ backgroundColor: color.hex ?? defaultSwatch(color.name) }} /> {color.name}
              </button>)}
            </div>
            <div className={styles.add}>
              <input aria-label="New color" placeholder="New color" maxLength={80} value={colorDraft}
                onChange={(event) => setColorDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addColor(); } }} />
              <button className="button secondary" type="button" onClick={addColor}>ADD COLOR</button>
            </div>
          </div>
          <div role="group" aria-label="Sizes to generate">
            <h3>SIZES</h3>
            <div className={styles.chips}>
              {sizes.map((size) => <button key={optionKey(size)} type="button"
                aria-pressed={chosenSizes.includes(optionKey(size))}
                onClick={() => setChosenSizes(toggle(optionKey(size), chosenSizes))}>{size}</button>)}
            </div>
            <div className={styles.add}>
              <input aria-label="New size" placeholder="New size" maxLength={40} value={sizeDraft}
                onChange={(event) => setSizeDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSize(); } }} />
              <button className="button secondary" type="button" onClick={addSize}>ADD SIZE</button>
            </div>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={generate}
          disabled={!chosenColors.length || !chosenSizes.length || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(baseSku)}>
          GENERATE COMBINATIONS
        </button>
        <p role="status" className="muted">{notice}</p>
        {rows.length > 0 && (
          <div className="table-scroll">
            <table className={styles.matrix}>
              <caption className="sr-only">Stock, SKU and status for each color and size</caption>
              <thead><tr><th scope="col">COLOR</th>{matrixSizes.map((size) => <th scope="col" key={size}>{size}</th>)}</tr></thead>
              <tbody>{matrixColors.map((color) => (
                <tr key={color.name}>
                  <th scope="row">
                    {color.name}
                    <label className={styles.colorPicker}>
                      <span className="sr-only">{color.name} swatch color</span>
                      <input type="color" value={color.hex ?? defaultSwatch(color.name)}
                        onChange={(event) => setColors(colors.map((item) => item === color ? { ...item, hex: event.target.value } : item))} />
                    </label>
                  </th>
                  {matrixSizes.map((size) => {
                    const row = rowsByOption.get(variantOptionKey(color.name, size));
                    if (!row) return <td key={size} className="muted">—</td>;
                    const label = `${color.name} / ${size}`;
                    const stock = Number(row.stock_quantity);
                    return <td key={size}>
                      <label className={styles.cellField}>
                        <span>Stock</span>
                        <input aria-label={`${label} stock`} type="number" min={0} max={1000000} step={1} required
                          value={row.stock_quantity} data-stock={stock === 0 ? "empty" : stock <= 3 ? "low" : undefined}
                          onChange={(event) => updateRow(row, { stock_quantity: event.target.value })} />
                      </label>
                      <label className={styles.cellField}>
                        <span>SKU</span>
                        <input aria-label={`${label} SKU`} value={row.sku} required maxLength={100}
                          pattern="[A-Z0-9][A-Z0-9_\\-]{0,99}"
                          onChange={(event) => updateRow(row, { sku: event.target.value.toUpperCase() })} />
                      </label>
                      <label className={styles.switch}>
                        <input type="checkbox" role="switch" aria-label={`${label} active`} checked={row.is_active}
                          onChange={(event) => updateRow(row, { is_active: event.target.checked })} />
                        <span>{row.is_active ? "Active" : "Inactive"}</span>
                      </label>
                    </td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </ActionForm>
    </section>
  );
}
