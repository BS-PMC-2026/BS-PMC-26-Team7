"use client";

import { useState } from "react";
import { createPepper, uploadPepperImage } from "@/services/peppers";

export default function CreatePepperPage() {
  const [formData, setFormData] = useState({
    PepperName: "",
    ScientificName: "",
    HeatLevelScovilleMin: "",
    HeatLevelScovilleMax: "",
    OptimalSoilMoistureMin: "",
    OptimalSoilMoistureMax: "",
    OptimalTempMinC: "",
    OptimalTempMaxC: "",
    OptimalSunlightHours: "",
    ImageUrl: "",
    Zone: "",
    GeneralDescription: "",
    IsActive: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  const toOptionalNumber = (value: string): number | undefined => {
    if (value.trim() === "") return undefined;
    return Number(value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const validateForm = () => {
  if (!formData.PepperName.trim()) {
    return "Pepper name is required.";
  }

  if (formData.PepperName.trim().length > 100) {
    return "Pepper name cannot exceed 100 characters.";
  }

  if (formData.ScientificName.trim().length > 150) {
    return "Scientific name cannot exceed 150 characters.";
  }

  if (formData.ImageUrl.trim().length > 500) {
    return "Image URL cannot exceed 500 characters.";
  }

  if (formData.Zone.trim().length > 500) {
    return "Zone cannot exceed 500 characters.";
  }

  if (formData.GeneralDescription.trim().length > 1000) {
    return "General description cannot exceed 1000 characters.";
  }

  const scovilleMin = toOptionalNumber(formData.HeatLevelScovilleMin);
  const scovilleMax = toOptionalNumber(formData.HeatLevelScovilleMax);
  const soilMin = toOptionalNumber(formData.OptimalSoilMoistureMin);
  const soilMax = toOptionalNumber(formData.OptimalSoilMoistureMax);
  const tempMin = toOptionalNumber(formData.OptimalTempMinC);
  const tempMax = toOptionalNumber(formData.OptimalTempMaxC);
  const sunlight = toOptionalNumber(formData.OptimalSunlightHours);

  if (scovilleMin !== undefined && scovilleMin < 0) {
    return "Scoville min cannot be negative.";
  }

  if (scovilleMax !== undefined && scovilleMax < 0) {
    return "Scoville max cannot be negative.";
  }

  if (scovilleMin !== undefined && scovilleMax !== undefined && scovilleMin > scovilleMax) {
    return "Scoville min cannot be greater than max.";
  }

  if (soilMin !== undefined && (soilMin < 0 || soilMin > 100)) {
    return "Soil moisture min must be between 0 and 100.";
  }

  if (soilMax !== undefined && (soilMax < 0 || soilMax > 100)) {
    return "Soil moisture max must be between 0 and 100.";
  }

  if (soilMin !== undefined && soilMax !== undefined && soilMin > soilMax) {
    return "Soil moisture min cannot be greater than max.";
  }

  if (tempMin !== undefined && (tempMin < -50 || tempMin > 80)) {
    return "Temperature min must be between -50 and 80.";
  }

  if (tempMax !== undefined && (tempMax < -50 || tempMax > 80)) {
    return "Temperature max must be between -50 and 80.";
  }

  if (tempMin !== undefined && tempMax !== undefined && tempMin > tempMax) {
    return "Temperature min cannot be greater than max.";
  }

  if (sunlight !== undefined && (sunlight < 0 || sunlight > 24)) {
    return "Sunlight hours must be between 0 and 24.";
  }

  if (formData.ImageUrl.trim()) {
    const imageUrl = formData.ImageUrl.trim();
    const isValidUrl =
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://") ||
      imageUrl.startsWith("/uploads/");

    if (!isValidUrl) {
      return "Image URL must start with http://, https://, or /uploads/.";
    }
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
      let finalImageUrl = formData.ImageUrl.trim() || undefined;

      if (selectedFile) {
        setUploadingImage(true);
        const uploadResult = await uploadPepperImage(selectedFile);
        finalImageUrl = uploadResult.imageUrl;
        setUploadingImage(false);
      }

      const payload = {
        PepperName: formData.PepperName.trim(),
        ScientificName: formData.ScientificName.trim() || undefined,
        HeatLevelScovilleMin: toOptionalNumber(formData.HeatLevelScovilleMin),
        HeatLevelScovilleMax: toOptionalNumber(formData.HeatLevelScovilleMax),
        OptimalSoilMoistureMin: toOptionalNumber(formData.OptimalSoilMoistureMin),
        OptimalSoilMoistureMax: toOptionalNumber(formData.OptimalSoilMoistureMax),
        OptimalTempMinC: toOptionalNumber(formData.OptimalTempMinC),
        OptimalTempMaxC: toOptionalNumber(formData.OptimalTempMaxC),
        OptimalSunlightHours: toOptionalNumber(formData.OptimalSunlightHours),
        ImageUrl: finalImageUrl,
        Zone: formData.Zone.trim() || undefined,
        GeneralDescription: formData.GeneralDescription.trim() || undefined,
        IsActive: formData.IsActive,
      };

      await createPepper(payload);

      setSuccessMessage("Pepper variety created successfully.");
      setSelectedFile(null);
      setFormData({
        PepperName: "",
        ScientificName: "",
        HeatLevelScovilleMin: "",
        HeatLevelScovilleMax: "",
        OptimalSoilMoistureMin: "",
        OptimalSoilMoistureMax: "",
        OptimalTempMinC: "",
        OptimalTempMaxC: "",
        OptimalSunlightHours: "",
        ImageUrl: "",
        Zone: "",
        GeneralDescription: "",
        IsActive: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create pepper.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "24px" }}>
        Create Pepper Variety
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        <input
          name="PepperName"
          placeholder="Pepper Name"
          value={formData.PepperName}
          onChange={handleChange}
          required
        />

        <input
          name="ScientificName"
          placeholder="Scientific Name"
          value={formData.ScientificName}
          onChange={handleChange}
        />

        <input
          name="HeatLevelScovilleMin"
          type="number"
          step="1"
          placeholder="Heat Level Scoville Min"
          value={formData.HeatLevelScovilleMin}
          onChange={handleChange}
        />

        <input
          name="HeatLevelScovilleMax"
          type="number"
          step="1"
          placeholder="Heat Level Scoville Max"
          value={formData.HeatLevelScovilleMax}
          onChange={handleChange}
        />

        <input
          name="OptimalSoilMoistureMin"
          type="number"
          step="0.01"
          placeholder="Optimal Soil Moisture Min"
          value={formData.OptimalSoilMoistureMin}
          onChange={handleChange}
        />

        <input
          name="OptimalSoilMoistureMax"
          type="number"
          step="0.01"
          placeholder="Optimal Soil Moisture Max"
          value={formData.OptimalSoilMoistureMax}
          onChange={handleChange}
        />

        <input
          name="OptimalTempMinC"
          type="number"
          step="0.01"
          placeholder="Optimal Temp Min (C)"
          value={formData.OptimalTempMinC}
          onChange={handleChange}
        />

        <input
          name="OptimalTempMaxC"
          type="number"
          step="0.01"
          placeholder="Optimal Temp Max (C)"
          value={formData.OptimalTempMaxC}
          onChange={handleChange}
        />

        <input
          name="OptimalSunlightHours"
          type="number"
          step="0.01"
          placeholder="Optimal Sunlight Hours"
          value={formData.OptimalSunlightHours}
          onChange={handleChange}
        />

        <input
          name="ImageUrl"
          placeholder="Image URL (optional)"
          value={formData.ImageUrl}
          onChange={handleChange}
        />

        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
        />

        <input
          name="Zone"
          placeholder="Zone"
          value={formData.Zone}
          onChange={handleChange}
        />

        <textarea
          name="GeneralDescription"
          placeholder="General Description"
          value={formData.GeneralDescription}
          onChange={handleChange}
          rows={5}
        />

        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            name="IsActive"
            type="checkbox"
            checked={formData.IsActive}
            onChange={handleChange}
          />
          Active
        </label>

        <button type="submit" disabled={loading || uploadingImage}>
          {uploadingImage
            ? "Uploading image..."
            : loading
            ? "Creating..."
            : "Create Pepper"}
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