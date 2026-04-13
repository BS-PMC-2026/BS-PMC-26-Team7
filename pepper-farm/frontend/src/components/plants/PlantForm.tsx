"use client";

import { useEffect, useState } from "react";
import { createPlant } from "@/services/plants";
import { getPepperVarieties } from "@/services/peppers";
import { PepperOption } from "@/types/plant";

export default function PlantForm() {
  const [formData, setFormData] = useState({
    PlantCode: "",
    PepperId: "",
    ZoneId: "",
    PlantedAt: "",
    Status: "",
    Notes: "",
    IsActive: true,
  });

  const [pepperOptions, setPepperOptions] = useState<PepperOption[]>([]);
  const [loadingPeppers, setLoadingPeppers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadPeppers = async () => {
      try {
        const peppers = await getPepperVarieties();
        setPepperOptions(peppers);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load pepper varieties."
        );
      } finally {
        setLoadingPeppers(false);
      }
    };

    loadPeppers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox" && "checked" in e.target) {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.PlantCode.trim()) {
      return "Plant code is required.";
    }

    if (formData.PlantCode.trim().length > 100) {
      return "Plant code cannot exceed 100 characters.";
    }

    if (!formData.PepperId) {
      return "Please select an existing pepper variety.";
    }

    if (formData.Status.trim().length > 50) {
      return "Status cannot exceed 50 characters.";
    }

    if (formData.Notes.trim().length > 500) {
      return "Notes cannot exceed 500 characters.";
    }

    if (formData.ZoneId && Number(formData.ZoneId) <= 0) {
      return "Zone ID must be a positive number.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      setLoading(false);
      return;
    }

    try {
      await createPlant({
        PlantCode: formData.PlantCode.trim(),
        PepperId: Number(formData.PepperId),
        ZoneId: formData.ZoneId ? Number(formData.ZoneId) : undefined,
        PlantedAt: formData.PlantedAt || undefined,
        Status: formData.Status.trim() || undefined,
        Notes: formData.Notes.trim() || undefined,
        IsActive: formData.IsActive,
      });

      setSuccessMessage("Plant created successfully.");
      setFormData({
        PlantCode: "",
        PepperId: "",
        ZoneId: "",
        PlantedAt: "",
        Status: "",
        Notes: "",
        IsActive: true,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create plant."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "24px" }}>
        Add Plant
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        <input
          name="PlantCode"
          placeholder="Plant Code"
          value={formData.PlantCode}
          onChange={handleChange}
          required
        />

        <select
          name="PepperId"
          value={formData.PepperId}
          onChange={handleChange}
          required
          disabled={loadingPeppers}
        >
          <option value="">
            {loadingPeppers ? "Loading varieties..." : "Select Pepper Variety"}
          </option>
          {pepperOptions.map((pepper) => (
            <option key={pepper.PepperId} value={pepper.PepperId}>
              {pepper.PepperName}
            </option>
          ))}
        </select>

        <input
          name="ZoneId"
          type="number"
          placeholder="Zone ID (optional)"
          value={formData.ZoneId}
          onChange={handleChange}
        />

        <input
          name="PlantedAt"
          type="datetime-local"
          value={formData.PlantedAt}
          onChange={handleChange}
        />

        <input
          name="Status"
          placeholder="Status (optional)"
          value={formData.Status}
          onChange={handleChange}
        />

        <textarea
          name="Notes"
          placeholder="Notes (optional)"
          value={formData.Notes}
          onChange={handleChange}
          rows={4}
        />

        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="checkbox"
            name="IsActive"
            checked={formData.IsActive}
            onChange={handleChange}
          />
          Active
        </label>

        <button type="submit" disabled={loading || loadingPeppers}>
          {loading ? "Saving..." : "Create Plant"}
        </button>

        {successMessage && (
          <p style={{ color: "green", fontWeight: 600 }}>{successMessage}</p>
        )}

        {errorMessage && (
          <p style={{ color: "red", fontWeight: 600 }}>{errorMessage}</p>
        )}
      </form>
    </div>
  );
}