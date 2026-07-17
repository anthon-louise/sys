import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  useProblem,
  useTestCases,
  useUpdateProblem,
  useDeleteProblem,
  useUpdateTestCase,
  useDeleteTestCase,
} from "../hooks/use-problem"
import {
  updateProblemSchema,
  type UpdateProblemForm,
} from "../schemas/problem.schema"
import {
  updateTestCaseSchema,
  type UpdateTestCaseForm,
} from "../schemas/testcase.schema"

export default function ProblemDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: problem, isLoading: problemLoading } = useProblem(id)
  const { data: testCases, isLoading: testCasesLoading } = useTestCases(id)
  const updateProblemMutation = useUpdateProblem(id)
  const deleteProblemMutation = useDeleteProblem()
  const updateTestCaseMutation = useUpdateTestCase(id)
  const deleteTestCaseMutation = useDeleteTestCase(id)

  const [showTestCasesModal, setShowTestCasesModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [editingTestCase, setEditingTestCase] = useState<any>(null)
  const [showEditTestCaseModal, setShowEditTestCaseModal] = useState(false)
  const [deletingTestCase, setDeletingTestCase] = useState<any>(null)
  const [showDeleteTestCaseModal, setShowDeleteTestCaseModal] = useState(false)

  const {
    register: editTestCaseRegister,
    handleSubmit: handleEditTestCaseSubmit,
    reset: resetEditTestCaseForm,
    formState: { errors: editTestCaseErrors },
  } = useForm<UpdateTestCaseForm>({
    resolver: zodResolver(updateTestCaseSchema),
  })

  const handleEditTestCase = (testCase: any) => {
    setEditingTestCase(testCase)
    resetEditTestCaseForm({
      inputData: testCase.inputData,
      expectedOutput: testCase.expectedOutput,
      isHidden: testCase.isHidden,
      orderIndex: testCase.orderIndex,
    })
    setShowEditTestCaseModal(true)
  }

  const handleUpdateTestCaseSubmit = async (data: UpdateTestCaseForm) => {
    try {
      await updateTestCaseMutation.mutateAsync({
        testCaseId: editingTestCase.testCaseId,
        data,
      })
      toast.success("Test case updated successfully!")
      setShowEditTestCaseModal(false)
      setEditingTestCase(null)
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update test case"
      )
    }
  }

  const handleDeleteTestCaseClick = (testCase: any) => {
    setDeletingTestCase(testCase)
    setShowDeleteTestCaseModal(true)
  }

  const handleDeleteTestCase = async () => {
    try {
      await deleteTestCaseMutation.mutateAsync(deletingTestCase.testCaseId)
      toast.success("Test case deleted successfully!")
      setShowDeleteTestCaseModal(false)
      setDeletingTestCase(null)
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to delete test case"
      )
    }
  }

  const {
    register: updateRegister,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdateForm,
    formState: { errors: updateErrors },
  } = useForm<UpdateProblemForm>({
    resolver: zodResolver(updateProblemSchema),
    defaultValues: {
      title: problem?.title || "",
      description: problem?.description || "",
      language: problem?.language || "",
      difficulty: problem?.difficulty || "",
      starterCode: problem?.starterCode || "",
    },
  })

  // Reset update form when problem data loads
  useEffect(() => {
    if (problem) {
      resetUpdateForm({
        title: problem.title,
        description: problem.description || "",
        language: problem.language,
        difficulty: problem.difficulty || "",
        starterCode: problem.starterCode || "",
      })
    }
  }, [problem, resetUpdateForm])

  const handleUpdate = async (data: UpdateProblemForm) => {
    try {
      await updateProblemMutation.mutateAsync(data)
      toast.success("Problem updated successfully!")
      setShowUpdateModal(false)
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update problem"
      )
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProblemMutation.mutateAsync(id!)
      toast.success("Problem deleted successfully!")
      navigate("/instructor/problem-bank")
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to delete problem"
      )
    }
  }

  if (problemLoading) {
    return (
      <div style={{ maxWidth: 800, margin: "2rem auto" }}>
        <p>Loading problem...</p>
      </div>
    )
  }

  if (!problem) {
    return (
      <div style={{ maxWidth: 800, margin: "2rem auto" }}>
        <p>Problem not found</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link
        to="/instructor/problem-bank"
        style={{ display: "inline-block", marginBottom: "1rem" }}
      >
        ← Back to Problem Bank
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0 }}>{problem.title}</h1>
        <span
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "4px",
            fontSize: "0.875rem",
            fontWeight: "bold",
            backgroundColor: problem.isValidated ? "#d4edda" : "#fff3cd",
            color: problem.isValidated ? "#155724" : "#856404",
          }}
        >
          {problem.isValidated ? "✅ Validated" : "⚠️ Not Validated"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setShowUpdateModal(true)}>Edit Problem</button>
        <button
          onClick={() => setShowDeleteConfirmModal(true)}
          style={{ backgroundColor: "#dc3545", color: "white" }}
        >
          Delete Problem
        </button>
        <Link
          to={`/instructor/problem/${id}/testcases`}
          style={{ textDecoration: "none" }}
        >
          <button>Create Test Cases</button>
        </Link>
        <button onClick={() => setShowTestCasesModal(true)}>
          View Test Cases
        </button>
        <Link
          to={`/instructor/problem/${id}/verify`}
          style={{ textDecoration: "none" }}
        >
          <button>Verify Problem</button>
        </Link>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1.5rem",
          background: "white",
        }}
      >
        <p>
          <strong>Language:</strong> {problem.language}
        </p>
        {problem.difficulty && (
          <p>
            <strong>Difficulty:</strong> {problem.difficulty}
          </p>
        )}
        <p>
          <strong>Created At:</strong>{" "}
          {new Date(problem.createdAt).toLocaleDateString()}
        </p>
        {problem.validatedAt && (
          <p>
            <strong>Validated At:</strong>{" "}
            {new Date(problem.validatedAt).toLocaleString()}
          </p>
        )}
        {problem.description && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3>Description</h3>
            <p>{problem.description}</p>
          </div>
        )}
        {problem.starterCode && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3>Starter Code</h3>
            <pre
              style={{
                background: "#f5f5f5",
                padding: "1rem",
                borderRadius: "4px",
                overflowX: "auto",
              }}
            >
              {problem.starterCode}
            </pre>
          </div>
        )}
      </div>

      {showTestCasesModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "8px",
              minWidth: "900px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2>Test Cases</h2>
              <button
                onClick={() => setShowTestCasesModal(false)}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {testCasesLoading ? (
              <p>Loading test cases...</p>
            ) : testCases && testCases.length > 0 ? (
              <div>
                <p>Total Test Cases: {testCases.length}</p>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: "1rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                      <th
                        style={{ textAlign: "left", padding: "0.5rem" }}
                      >
                        #
                      </th>
                      <th
                        style={{ textAlign: "left", padding: "0.5rem" }}
                      >
                        Input
                      </th>
                      <th
                        style={{ textAlign: "left", padding: "0.5rem" }}
                      >
                        Expected Output
                      </th>
                      <th
                        style={{ textAlign: "left", padding: "0.5rem" }}
                      >
                        Hidden
                      </th>
                      <th
                        style={{ textAlign: "left", padding: "0.5rem" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((tc, index) => (
                      <tr
                        key={tc.testCaseId}
                        style={{ borderBottom: "1px solid #eee" }}
                      >
                        <td style={{ padding: "0.5rem" }}>
                          {index + 1}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tc.inputData}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tc.expectedOutput}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {tc.isHidden ? "Yes" : "No"}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            display: "flex",
                            gap: "0.5rem",
                          }}
                        >
                          <button
                            onClick={() => handleEditTestCase(tc)}
                            style={{ padding: "0.25rem 0.5rem" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTestCaseClick(tc)}
                            style={{
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "#dc3545",
                              color: "white",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No test cases yet.</p>
            )}
          </div>
        </div>
      )}

      {showEditTestCaseModal && editingTestCase && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "8px",
              minWidth: "500px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2>Edit Test Case</h2>
              <button
                onClick={() => {
                  setShowEditTestCaseModal(false)
                  setEditingTestCase(null)
                }}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={handleEditTestCaseSubmit(
                handleUpdateTestCaseSubmit
              )}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Input Data
                </label>
                <textarea
                  {...editTestCaseRegister("inputData")}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    minHeight: "80px",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
                {editTestCaseErrors.inputData && (
                  <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>
                    {editTestCaseErrors.inputData.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Expected Output
                </label>
                <textarea
                  {...editTestCaseRegister("expectedOutput")}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    minHeight: "80px",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
                {editTestCaseErrors.expectedOutput && (
                  <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>
                    {editTestCaseErrors.expectedOutput.message}
                  </p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <input
                  type="checkbox"
                  id="editIsHidden"
                  {...editTestCaseRegister("isHidden")}
                />
                <label htmlFor="editIsHidden">Hidden test case</label>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTestCaseModal(false)
                    setEditingTestCase(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTestCaseMutation.isPending}
                >
                  {updateTestCaseMutation.isPending
                    ? "Updating..."
                    : "Update Test Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteTestCaseModal && deletingTestCase && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "8px",
              minWidth: "400px",
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>
              Delete Test Case?
            </h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Are you sure you want to delete this test case? This action
              cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowDeleteTestCaseModal(false)
                  setDeletingTestCase(null)
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTestCase}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                }}
                disabled={deleteTestCaseMutation.isPending}
              >
                {deleteTestCaseMutation.isPending
                  ? "Deleting..."
                  : "Delete Test Case"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "8px",
              minWidth: "500px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2>Edit Problem</h2>
              <button
                onClick={() => setShowUpdateModal(false)}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit(handleUpdate)}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Title
                </label>
                <input
                  {...updateRegister("title")}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    boxSizing: "border-box",
                  }}
                />
                {updateErrors.title && (
                  <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>
                    {updateErrors.title.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Language
                </label>
                <input
                  {...updateRegister("language")}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    boxSizing: "border-box",
                  }}
                />
                {updateErrors.language && (
                  <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>
                    {updateErrors.language.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Difficulty (optional)
                </label>
                <input
                  {...updateRegister("difficulty")}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Description (optional)
                </label>
                <textarea
                  {...updateRegister("description")}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    minHeight: "100px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Starter Code (optional)
                </label>
                <textarea
                  {...updateRegister("starterCode")}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    minHeight: "150px",
                    fontFamily: "monospace",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProblemMutation.isPending}
                >
                  {updateProblemMutation.isPending
                    ? "Updating..."
                    : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "8px",
              minWidth: "400px",
            }}
          >
            <h2 style={{ marginBottom: "1rem" }}>Delete Problem?</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Are you sure you want to delete this problem? This action
              cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                }}
                disabled={deleteProblemMutation.isPending}
              >
                {deleteProblemMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
