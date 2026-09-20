import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { PageHeader, ErrorMessage, Loading } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

import { useBrand } from "./api";
import { BrandReview } from "./brand-review";
export function BrandPage() {
    const query = useBrand();
    return (
        <div className="page-container">
            <PageHeader
                title="Brand"
                description="The references and rules behind your campaigns."
                action={
                    <Button variant="outline" asChild>
                        <Link to="/onboarding">
                            Update references
                            <ArrowRight size={16} />
                        </Link>
                    </Button>
                }
            />
            {query.isPending ? (
                <Loading />
            ) : query.error ? (
                <ErrorMessage error={query.error} retry={() => void query.refetch()} />
            ) : query.data.profile ? (
                <BrandReview key={query.data.profileVersion} brand={query.data} />
            ) : (
                <div className="empty-state">
                    <h2>Set up your brand</h2>
                    <p>Add your Instagram profile, brand guidelines and product images.</p>
                    <Button asChild>
                        <Link to="/onboarding">
                            Get started
                            <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
