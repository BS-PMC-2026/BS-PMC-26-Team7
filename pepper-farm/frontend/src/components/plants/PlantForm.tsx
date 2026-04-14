"use client";

import { useEffect, useState } from "react";
import { createPlant } from "@/services/plants";
import { getAllPeppers } from "@/services/peppers";
import { PepperOption } from "@/types/plant";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";

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
        const peppers = await getAllPeppers();
        setPepperOptions(peppers);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load pepper varieties."
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
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.PlantCode.trim()) return "Plant code is required.";
    if (formData.PlantCode.trim().length > 100) return "Plant code cannot exceed 100 characters.";
    if (!formData.PepperId) return "Please select an existing pepper variety.";
    if (formData.Status.trim().length > 50) return "Status cannot exceed 50 characters.";
    if (formData.Notes.trim().length > 500) return "Notes cannot exceed 500 characters.";
    if (formData.ZoneId && Number(formData.ZoneId) <= 0) return "Zone ID must be a positive number.";
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
      setFormData({ PlantCode: "", PepperId: "", ZoneId: "", PlantedAt: "", Status: "", Notes: "", IsActive: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create plant.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50";

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Plant</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="PlantCode" label="Plant Code" name="PlantCode" value={formData.PlantCode} onChange={handleChange} required />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="PepperId">Pepper Variety</label>
          <select id="PepperId" name="PepperId" value={formData.PepperId} onChange={handleChange} required disabled={loadingPeppers} className={fieldClass}>
            <option value="">{loadingPeppers ? "Loading varieties..." : "Select Pepper Variety"}</option>
            {pepperOptions.map((pepper) => (
              <option key={pepper.PepperId} value={pepper.PepperId}>{pepper.PepperName}</option>
            ))}
          </select>
        </div>

        <Input id="ZoneId" label="Zone ID (optional)" name="ZoneId" type="number" value={formData.ZoneId} onChange={handleChange} />
        <Input id="PlantedAt" label="Planted At (optional)" name="PlantedAt" type="datetime-local" value={formData.PlantedAt} onChange={handleChange} />
        <Input id="Status" label="Status (optional)" name="Status" value={formData.Status} onChange={handleChange} />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="Notes">Notes (optional)</label>
          <textarea id="Notes" name="Notes" value={formData.Notes} onChange={handleChange} rows={4}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" name="IsActive" checked={formData.IsActive} onChange={handleChange} className="rounded" />
          Active
        </label>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading || loadingPeppers}>
            {loading ? "Saving..." : "Create Plant"}
          </Button>
        </div>

        {successMessage && <Alert variant="success">{successMessage}</Alert>}
        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      </form>
    </div>
  );
}
