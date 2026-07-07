import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useCreateTestCases } from "../hooks/use-problem"
import type { CreateTestCaseForm } from "../schemas/testcase.schema"

const MAX_TEST_CASES = 10

export default function CreateTestCases() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const createTestCasesMutation = useCreateTestCases(id)

  const [testCases, setTestCases] = useState<CreateTestCaseForm[]>([
    { inputData: "", expectedOutput: "", isHidden: false, orderIndex: 0 }
  ])

  const addTestCase = () => {
    if (testCases.length < MAX_TEST_CASES) {
      setTestCases([
        ...testCases,
        { inputData: "", expectedOutput: "", isHidden: false, orderIndex: testCases.length }
      ])
    }
  }

  const removeTestCase = (index: number) => {
    const newTestCases = testCases.filter((_, i) => i !== index)
    const updatedTestCases = newTestCases.map((tc, i) => ({ ...tc, orderIndex: i }))
    setTestCases(updatedTestCases)
  }

  const updateTestCase = (index: number, field: keyof CreateTestCaseForm, value: any) => {
    const newTestCases = [...testCases]
    newTestCases[index] = { ...newTestCases[index], [field]: value }
    setTestCases(newTestCases)
  }

  const handleSubmit = async () => {
    try {
      await createTestCasesMutation.mutateAsync(testCases)
      toast.success("Test cases created successfully!")
      navigate(`/instructor/problem/${id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to create test cases")
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link to={`/instructor/problem/${id}`} style={{ display: "inline-block", marginBottom: "1rem" }}>← Back to Problem</Link>
      <h1>Create Test Cases</h1>
      <p>Max {MAX_TEST_CASES} test cases</p>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white", maxHeight: "70vh", overflowY: "auto" }}>
        {testCases.map((testCase, index) => (
          <div key={index} style={{ border: "1px solid #eee", borderRadius: "4px", padding: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Test Case {index + 1}</h3>
              {testCases.length > 1 && (
                <button onClick={() => removeTestCase(index)} style={{ background: "#ff4444", color: "white", border: "none", padding: "0.25rem 0.5rem", borderRadius: "4px", cursor: "pointer" }}>Remove</button>
              )}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem" }}>Input Data</label>
              <textarea
                value={testCase.inputData}
                onChange={(e) => updateTestCase(index, "inputData", e.target.value)}
                style={{ width: "100%", padding: "0.5rem", minHeight: "80px", boxSizing: "border-box", fontFamily: "monospace" }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem" }}>Expected Output</label>
              <textarea
                value={testCase.expectedOutput}
                onChange={(e) => updateTestCase(index, "expectedOutput", e.target.value)}
                style={{ width: "100%", padding: "0.5rem", minHeight: "80px", boxSizing: "border-box", fontFamily: "monospace" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id={`isHidden-${index}`}
                checked={testCase.isHidden ?? false}
                onChange={(e) => updateTestCase(index, "isHidden", e.target.checked)}
              />
              <label htmlFor={`isHidden-${index}`}>Hidden test case</label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          onClick={addTestCase}
          disabled={testCases.length >= MAX_TEST_CASES}
          style={{ opacity: testCases.length >= MAX_TEST_CASES ? 0.5 : 1 }}
        >
          Add Test Case
        </button>
        <button onClick={handleSubmit} disabled={createTestCasesMutation.isPending}>
          {createTestCasesMutation.isPending ? "Creating..." : "Create Test Cases"}
        </button>
      </div>
    </div>
  )
}
